using pv_calc_service.Grains;
using pv_calc_service.Models;

namespace pv_calc_service.Endpoints;

public static class SimulationEndpoints
{
    public static void MapSimulationEndpoints(this WebApplication app)
    {
        // Triggered by API Gateway when user clicks "Start calculation →" in Step 4
        app.MapPost("/api/simulation/{projectId}/start", async (
            string projectId,
            SimulationInput input,
            IGrainFactory grains,
            CancellationToken ct) =>
        {
            // Each project gets its own grain — isolated state, no cross-project interference
            var grain = grains.GetGrain<ISimulationGrain>(projectId);
            await grain.StartAsync(input);
            return Results.Accepted();
        });

        // Polled by Angular after SignalR notifies that calculation is done
        app.MapGet("/api/simulation/{projectId}/result", async (
            string projectId,
            IGrainFactory grains,
            CancellationToken ct) =>
        {
            var grain = grains.GetGrain<ISimulationGrain>(projectId);
            var status = await grain.GetStatusAsync();

            if (status == SimulationStatus.Pending || status == SimulationStatus.Running)
                return Results.Accepted(null, new { Status = status.ToString() });

            if (status == SimulationStatus.Failed)
                return Results.Problem("Simulation failed.");

            var result = await grain.GetResultAsync();
            return Results.Ok(result);
        });

        // Used by Step 5 (Sizing) progress indicator
        app.MapGet("/api/simulation/{projectId}/status", async (
            string projectId,
            IGrainFactory grains) =>
        {
            var grain = grains.GetGrain<ISimulationGrain>(projectId);
            var status = await grain.GetStatusAsync();
            return Results.Ok(new { Status = status.ToString() });
        });
    }
}