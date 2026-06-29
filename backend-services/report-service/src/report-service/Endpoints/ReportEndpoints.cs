using report_service.Models;
using report_service.Services;

namespace report_service.Endpoints;

public static class ReportEndpoints
{
    public static void MapReportEndpoints(this WebApplication app)
    {
        // Called by API Gateway when user clicks "Download" in Step 8
        app.MapPost("/api/reports/generate", async (
            ReportData data,
            PdfService pdf,
            StorageService storage,
            CancellationToken ct) =>
        {
            var pdfBytes = pdf.Generate(data);
            var objectName = await storage.UploadAsync(data.ProjectName, pdfBytes, ct);

            return Results.Ok(new { ObjectName = objectName });
        });

        // Direct PDF download — streamed to avoid loading full file into memory
        app.MapGet("/api/reports/download/{*objectName}", async (
            string objectName,
            StorageService storage,
            CancellationToken ct) =>
        {
            var stream = await storage.DownloadAsync(objectName, ct);
            return Results.Stream(stream, "application/pdf",
                fileDownloadName: "fronius-solar-report.pdf");
        });
    }
}