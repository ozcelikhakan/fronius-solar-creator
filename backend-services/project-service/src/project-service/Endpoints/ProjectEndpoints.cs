using project_service.Models;
using project_service.Repositories;

namespace project_service.Endpoints;

public static class ProjectEndpoints
{
    public static void MapProjectEndpoints(this WebApplication app)
    {
        // Returns all projects — API Gateway's [Authorize] already guards this call
        app.MapGet("/api/projects", async (
            ProjectRepository repo,
            CancellationToken ct) =>
        {
            var projects = await repo.GetAllAsync(ct);
            return Results.Ok(projects.Select(ToDto));
        });

        app.MapGet("/api/projects/{id}", async (
            string id,
            ProjectRepository repo,
            CancellationToken ct) =>
        {
            var project = await repo.GetByIdAsync(id, ct);
            return project is null ? Results.NotFound() : Results.Ok(ToDto(project));
        });

        app.MapPost("/api/projects", async (
            CreateProjectRequest req,
            ProjectRepository repo,
            CancellationToken ct) =>
        {
            var project = new Project
            {
                Name              = req.Name,
                CustomerFirstName = req.CustomerFirstName,
                CustomerLastName  = req.CustomerLastName,
                CustomerEmail     = req.CustomerEmail,
                CustomerCompany   = req.CustomerCompany,
                CustomerPhone     = req.CustomerPhone,
                Currency          = req.Currency,
                MeasurementSystem = req.MeasurementSystem,
                TemperatureUnit   = req.TemperatureUnit,
                CableStandard     = req.CableStandard,
                ProjectTypes      = req.ProjectTypes
            };

            var created = await repo.CreateAsync(project, ct);
            return Results.Created($"/api/projects/{created.Id}", ToDto(created));
        });

        app.MapDelete("/api/projects/{id}", async (
            string id,
            ProjectRepository repo,
            CancellationToken ct) =>
        {
            var deleted = await repo.DeleteAsync(id, ct);
            return deleted ? Results.NoContent() : Results.NotFound();
        });
    }

    // Central mapping keeps both endpoint and API Gateway DTO shapes in sync
    private static ProjectDto ToDto(Project p) => new(
        p.Id, p.Name,
        p.CustomerFirstName, p.CustomerLastName, p.CustomerEmail, p.CustomerCompany,
        p.Currency, p.MeasurementSystem, p.TemperatureUnit, p.CableStandard,
        p.ProjectTypes, p.CreatedAt, p.UpdatedAt
    );
}

// Mirrors CreateProjectInput in api-gateway — kept separate so changes don't couple services
internal record CreateProjectRequest(
    string Name,
    string? CustomerFirstName,
    string? CustomerLastName,
    string? CustomerEmail,
    string? CustomerCompany,
    string? CustomerPhone,
    string Currency,
    string MeasurementSystem,
    string TemperatureUnit,
    string CableStandard,
    List<string> ProjectTypes
);

// Mirrors ProjectDto in api-gateway
internal record ProjectDto(
    string Id,
    string Name,
    string? CustomerFirstName,
    string? CustomerLastName,
    string? CustomerEmail,
    string? CustomerCompany,
    string Currency,
    string MeasurementSystem,
    string TemperatureUnit,
    string CableStandard,
    List<string> ProjectTypes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);