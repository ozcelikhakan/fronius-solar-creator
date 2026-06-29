using report_service.Endpoints;
using report_service.Services;

var builder = WebApplication.CreateBuilder(args);

//Each request gets its own PdfService instance 
builder.Services.AddScoped<PdfService>();

//Singleton: MinIO client manages its own connection pool internally
builder.Services.AddSingleton<StorageService>();

var app = builder.Build();

app.MapReportEndpoints();

app.Run();