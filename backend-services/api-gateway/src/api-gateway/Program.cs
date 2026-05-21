using System.Text;
using api_gateway.Auth;
using api_gateway.GraphQL.Mutations;
using api_gateway.GraphQL.Queries;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// JWT
var jwtSettings = builder.Configuration.GetSection("JWT");
var secret = jwtSettings["Secret"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidAudience = jwtSettings["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret))
        };

        // SignalR için token query string desteği
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// HTTP clients — downstream servisler
builder.Services.AddHttpClient("project-service", c =>
    c.BaseAddress = new Uri(builder.Configuration["Services:ProjectService"]!));
builder.Services.AddHttpClient("weather-service", c =>
    c.BaseAddress = new Uri(builder.Configuration["Services:WeatherService"]!));
builder.Services.AddHttpClient("pv-calc-service", c =>
    c.BaseAddress = new Uri(builder.Configuration["Services:PvCalcService"]!));
builder.Services.AddHttpClient("report-service", c =>
    c.BaseAddress = new Uri(builder.Configuration["Services:ReportService"]!));

// Servisler
builder.Services.AddScoped<JwtTokenService>();

// CORS — Angular dev server
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// GraphQL — Hot Chocolate
builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>()
    .AddAuthorization();

var app = builder.Build();

app.UseCors("AllowAngular");
app.UseAuthentication();
app.UseAuthorization();

app.MapGraphQL("/graphql");

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.Run();
