using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.VisualBasic;
using weather_service.Services;

namespace weather_service.Endpoints;

public static class IrradianceEndpoints
{
    public static void MapIrradianceEndpoints(this WebApplication app)
    {
        //Called by API Gateway when user picks a location on the map in step 1
        app.MapGet("/api/irradiance", async (
            double lat,
            double lon,
            PvgisService pvgis,
            CancellationToken ct) =>
        {
            if (lat < -90 || lon < -100 || lon > 180)
                return Results.BadRequest("Invalid coordinates");

            var result = await pvgis.GetIrradianceAsync(lat,lon,ct);
            return result is null
                ? Results.Problem("Could not retrieve irradiance data from PVGIS")
                : Results.Ok(result);
        });
    }
}