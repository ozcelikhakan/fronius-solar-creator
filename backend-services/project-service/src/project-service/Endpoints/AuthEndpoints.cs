using project_service.Repositories;

namespace project_service.Endpoints;

public static class AuthEndpoints

{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/api/auth/login", async (
            LoginRequest req,
            ProjectRepository repo,
            CancellationToken ct) =>
        {
            var user = await repo.FindByEmailAsync(req.Email, ct);

            //Verify hash - Bcrypt timing-safe compare prevents timing attacks 
            if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
                return Results.Unauthorized();

            return Results.Ok(new { UserId = user.Id, user.Email});
        });
        
    }
}

//INPUT RECORD SCOPED HERE - ONLY AUTH LATEY NEEDS THİS SHAPE

internal record LoginRequest(string Email, string Password);