using System.Net.Http.Json;
using api_gateway.Auth;
using api_gateway.GraphQL.Types;
using HotChocolate.Authorization;

namespace api_gateway.GraphQL.Mutations;

public class Mutation
{
    public async Task<LoginPayload> LoginAsync(
        LoginInput input,
        [Service] IHttpClientFactory factory,
        [Service] JwtTokenService tokenService,
        CancellationToken ct)
    {
        // project-service üzerinden kimlik doğrulama
        var client = factory.CreateClient("project-service");
        var response = await client.PostAsJsonAsync("/api/auth/login", input, ct);
        response.EnsureSuccessStatusCode();

        var user = await response.Content.ReadFromJsonAsync<UserAuthResult>(
            cancellationToken: ct) ?? throw new Exception("Invalid credentials.");

        var token = tokenService.GenerateToken(user.UserId, user.Email);
        return new LoginPayload(token, user.UserId, user.Email);
    }

    [Authorize]
    public async Task<ProjectDto> CreateProjectAsync(
        CreateProjectInput input,
        [Service] IHttpClientFactory factory,
        CancellationToken ct)
    {
        var client = factory.CreateClient("project-service");
        var response = await client.PostAsJsonAsync("/api/projects", input, ct);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<ProjectDto>(
            cancellationToken: ct) ?? throw new Exception("Failed to create project.");
    }

    [Authorize]
    public async Task<bool> StartSimulationAsync(
        string projectId,
        [Service] IHttpClientFactory factory,
        CancellationToken ct)
    {
        var client = factory.CreateClient("pv-calc-service");
        var response = await client.PostAsync(
            $"/api/simulation/{projectId}/start", null, ct);
        return response.IsSuccessStatusCode;
    }

    [Authorize]
    public async Task<bool> DeleteProjectAsync(
        string id,
        [Service] IHttpClientFactory factory,
        CancellationToken ct)
    {
        var client = factory.CreateClient("project-service");
        var response = await client.DeleteAsync($"/api/projects/{id}", ct);
        return response.IsSuccessStatusCode;
    }
}

internal record UserAuthResult(string UserId, string Email);