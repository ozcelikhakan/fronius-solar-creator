using pv_calc_service.Models;

namespace pv_calc_service.Grains;

//One grain instance per project - grain key is the projectId

public interface ISimulationGrain : IGrainWithStringKey
{
    Task StartAsync(SimulationInput input);
    Task<SimulationStatus> GetStatusAsync();
    Task<SimulationResult?> GetResultAsync();
}