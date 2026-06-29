using System.Text;
using System.Text.Json;
using pv_calc_service.Models;
using RabbitMQ.Client;

namespace pv_calc_service.Grains;

public class SimulationGrain : Grain<SimulationState>, ISimulationGrain
{
    private readonly IConfiguration _config;

    public SimulationGrain(IConfiguration config)
    {
        _config = config;
    }

    public async Task StartAsync(SimulationInput input)
    {
        // Prevent duplicate runs if the grain is already processing
        if (State.Status == SimulationStatus.Running) return;

        State.Status = SimulationStatus.Running;
        State.Input = input;
        await WriteStateAsync();

        // Fire-and-forget: calculation continues even if the HTTP caller disconnects
        _ = Task.Run(() => RunCalculationAsync(input));
    }

    public Task<SimulationStatus> GetStatusAsync() =>
        Task.FromResult(State.Status);

    public Task<SimulationResult?> GetResultAsync() =>
        Task.FromResult(State.Result);

    private async Task RunCalculationAsync(SimulationInput input)
    {
        try
        {
            // Shading 3% + Soiling 2% + Wiring 2% + Mismatch 1% = 8% total loss
            const double pr = 0.92;

            // ── Annual Yield ──────────────────────────────────────────────────
            double yearlyYield = Math.Round(input.PeakPowerKwp * input.IrradianceKwhM2 * pr, 1);

            // ── Self-consumption: PV generation used directly in the house ────
            double directUse = Math.Min(yearlyYield, input.AnnualConsumptionKwh);
            double selfConsumptionRate = yearlyYield > 0
                ? Math.Round(directUse / yearlyYield, 3) : 0;

            // ── Self-sufficiency: how much of demand is covered by PV+battery ─
            double pvAndBattery = Math.Min(
                yearlyYield + input.BatteryCapacityKwh * 365 * 0.9, // battery cycles * efficiency
                input.AnnualConsumptionKwh);
            double selfSufficiencyRate = input.AnnualConsumptionKwh > 0
                ? Math.Round(pvAndBattery / input.AnnualConsumptionKwh, 3) : 0;

            // ── Financial ────────────────────────────────────────────────────
            double savings = Math.Round(directUse * input.ElectricityCostEurKwh, 2);
            double feedInKwh = Math.Max(0, yearlyYield - directUse);
            double feedInRevenue = Math.Round(feedInKwh * input.FeedInTariffEurKwh, 2);
            double annualBenefit = savings + feedInRevenue;
            double roiMonths = annualBenefit > 0
                ? Math.Round(input.TotalSystemCostEur / annualBenefit * 12, 1) : 0;

            // ── CO₂ savings — Austrian grid emission factor 2024 ─────────────
            double co2Kg = Math.Round(yearlyYield * 0.132, 1);

            // ── Monthly production (sinusoidal approximation) ─────────────────
            // Real hourly simulation would use 8760 data points; this gives a realistic shape
            var monthlyFactors = new[]
            { 0.04, 0.05, 0.08, 0.10, 0.12, 0.13, 0.13, 0.12, 0.10, 0.07, 0.04, 0.02 };
            var monthly = monthlyFactors.Select((f, i) => new MonthlyData
            {
                Month = i + 1,
                ProductionKwh = Math.Round(yearlyYield * f, 1),
                ConsumptionKwh = Math.Round(input.AnnualConsumptionKwh / 12, 1)
            }).ToList();

            // ── Amortization (30-year cumulative) ────────────────────────────
            var amortization = Enumerable.Range(1, input.CalculationPeriodYears)
                .Select(y => new AmortizationPoint
                {
                    Year = y,
                    CumulativeSavings = Math.Round(annualBenefit * y, 2),
                    CumulativeCost = input.TotalSystemCostEur
                }).ToList();

            State.Result = new SimulationResult
            {
                YearlyYieldKwh = yearlyYield,
                SelfConsumptionRate = selfConsumptionRate,
                SelfSufficiencyRate = selfSufficiencyRate,
                PerformanceRatio = pr,
                SavingsPerYear = savings,
                FeedInRevenue = feedInRevenue,
                ReturnOnInvestmentMonths = roiMonths,
                Co2SavingsKgPerYear = co2Kg,
                AmortizationData = amortization,
                MonthlyProduction = monthly
            };

            State.Status = SimulationStatus.Completed;
            await WriteStateAsync();

            // Notify notification-service so it can push SignalR event to Angular
            await PublishCompletionEventAsync(input.ProjectId);
        }
        catch
        {
            State.Status = SimulationStatus.Failed;
            await WriteStateAsync();
        }
    }

    // Fire-and-forget async publish — RabbitMQ.Client 7.x uses fully async API
    private async Task PublishCompletionEventAsync(string projectId)
    {
        try
        {
            var factory = new ConnectionFactory
            {
                Uri = new Uri(_config["RabbitMQ:ConnectionString"]!)
            };
            await using var connection = await factory.CreateConnectionAsync();
            await using var channel = await connection.CreateChannelAsync();

            await channel.QueueDeclareAsync("simulation.completed", durable: true,
                exclusive: false, autoDelete: false);

            var body = Encoding.UTF8.GetBytes(
                JsonSerializer.Serialize(new { ProjectId = projectId }));

            await channel.BasicPublishAsync(exchange: "", routingKey: "simulation.completed",
                mandatory: false, body: body);
        }
        catch
        {
            // Non-critical: SignalR notification failure doesn't invalidate the result
        }
    }
}