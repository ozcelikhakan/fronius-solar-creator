
using project_service.Endpoints;
using project_service.Models;
using project_service.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Singleton because MongoClient manages its own connection pool internally
builder.Services.AddSingleton<ProjectRepository>();

var app = builder.Build();

app.MapAuthEndpoints();
app.MapProjectEndpoints();

// Seed demo user on startup so the portfolio works out-of-the-box without manual setup
await SeedDemoUserAsync(app);

app.Run();

static async Task SeedDemoUserAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var repo   = scope.ServiceProvider.GetRequiredService<ProjectRepository>();
    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

    var email    = config["Seed:DemoEmail"]!;
    var password = config["Seed:DemoPassword"]!;

    var existing = await repo.FindByEmailAsync(email, CancellationToken.None);
    if (existing is not null) return; // Already seeded — skip

    await repo.CreateUserAsync(new User
    {
        Email        = email,
        // Work factor 12 is OWASP minimum for 2024 — balances security vs login latency
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12)
    }, CancellationToken.None);
}
