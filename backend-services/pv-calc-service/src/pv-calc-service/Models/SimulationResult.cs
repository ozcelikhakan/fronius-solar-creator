namespace pv_calc_service.Models;

public enum SimulationStatus { Pending, Running, Completed, Failed }

// Grain state — persisted to MongoDB so result survives service restarts
[GenerateSerializer]
public class SimulationState
{
    [Id(0)] public SimulationStatus Status { get; set; } = SimulationStatus.Pending;
    [Id(1)] public SimulationResult? Result { get; set; }
    [Id(2)] public SimulationInput? Input { get; set; }
}

// Final output shown in Step 8 (Report) — mirrors SimulationResultDto in api-gateway
[GenerateSerializer]
public class SimulationResult
{
    [Id(0)] public double YearlyYieldKwh { get; set; }
    [Id(1)] public double SelfConsumptionRate { get; set; }   // 0-1
    [Id(2)] public double SelfSufficiencyRate { get; set; }   // 0-1
    [Id(3)] public double PerformanceRatio { get; set; }      // Typically ~0.92
    [Id(4)] public double SavingsPerYear { get; set; }
    [Id(5)] public double FeedInRevenue { get; set; }
    [Id(6)] public double ReturnOnInvestmentMonths { get; set; }
    [Id(7)] public double Co2SavingsKgPerYear { get; set; }
    [Id(8)] public List<AmortizationPoint> AmortizationData { get; set; } = [];
    [Id(9)] public List<MonthlyData> MonthlyProduction { get; set; } = [];
}

[GenerateSerializer]
public class AmortizationPoint
{
    [Id(0)] public int Year { get; set; }
    [Id(1)] public double CumulativeSavings { get; set; }
    [Id(2)] public double CumulativeCost { get; set; }
}

[GenerateSerializer]
public class MonthlyData
{
    [Id(0)] public int Month { get; set; }
    [Id(1)] public double ProductionKwh { get; set; }
    [Id(2)] public double ConsumptionKwh { get; set; }
}