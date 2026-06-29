using weather_service.Endpoints;
using weather_service.Services;

var builder = WebApplication.CreateBuilder(args);

// Named HttpClient keeps PVGIS base URL in config — no magic strings in service classes
builder.Services.AddHttpClient("pvgis", c =>
    c.BaseAddress = new Uri(builder.Configuration["PVGIS:BaseUrl"]!));

// Singleton because Redis ConnectionMultiplexer is designed to be long-lived and shared
builder.Services.AddSingleton<CacheService>();
builder.Services.AddScoped<PvgisService>();

var app = builder.Build();

app.MapIrradianceEndpoints();

app.Run();