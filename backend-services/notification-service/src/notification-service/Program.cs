using notification_service.Hubs;
using notification_service.Services;

var builder = WebApplication.CreateBuilder(args);

var allowedOrigin = builder.Configuration["Cors:AllowedOrigin"]!;


builder.Services.AddCors(options =>
    options.AddPolicy("AllowAngular", policy =>
        policy.WithOrigins(allowedOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));


builder.Services.AddSignalR();

// RabbitMQ listener runs as a background service for the app lifetime
builder.Services.AddHostedService<RabbitMqListener>();

var app = builder.Build();

app.UseCors("AllowAngular");

// Angular connects to this endpoint via SignalR client library
app.MapHub<SimulationHub>("/hubs/simulation");

app.Run();