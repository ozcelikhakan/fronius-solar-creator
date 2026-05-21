using System.Net.Http.Json;
using api_gateway.GraphQL.Types;
using HotChocolate.Authorization;

namespace api_gateway.GraphQL.Queries;

public class Query
{
    [Authorize]
    public async Task<IEnumerable<ProjectDto>> GetProjectsAsync(
        [Service] IHttpClientFactory factory,
        CancellationToken ct)
    {
        var client = factory.CreateClient("project-service");
        var result = await client.GetFromJsonAsync<IEnumerable<ProjectDto>>(
            "/api/projects", ct);
        return result ?? [];
    }

    [Authorize]
    public async Task<ProjectDto?> GetProjectAsync(
        string id,
        [Service] IHttpClientFactory factory,
        CancellationToken ct)
    {
        var client = factory.CreateClient("project-service");
        return await client.GetFromJsonAsync<ProjectDto>(
            $"/api/projects/{id}", ct);
    }

    [Authorize]
    public async Task<LocationDto?> GetIrradianceAsync(
        double latitude,
        double longitude,
        [Service] IHttpClientFactory factory,
        CancellationToken ct)
    {
        var client = factory.CreateClient("weather-service");
        return await client.GetFromJsonAsync<LocationDto>(
            $"/api/irradiance?lat={latitude}&lon={longitude}", ct);
    }

    [Authorize]
    public async Task<SimulationResultDto?> GetSimulationResultAsync(
        string projectId,
        [Service] IHttpClientFactory factory,
        CancellationToken ct)
    {
        var client = factory.CreateClient("pv-calc-service");
        return await client.GetFromJsonAsync<SimulationResultDto>(
            $"/api/simulation/{projectId}/result", ct);
    }
}