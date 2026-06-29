using System.Text.Json;
using weather_service.Models;

namespace weather_service.Services;

public class PvgisService
{
    private readonly HttpClient _http;
    private readonly CacheService _cache;

    public PvgisService(IHttpClientFactory factory, CacheService cache)
    {
        _http = factory.CreateClient("pvgis");
        _cache = cache;
    }

    public async Task<IrradianceResult?> GetIrradianceAsync(
        double lat, double lon, CancellationToken ct)
    {
        var cacheKey = CacheService.IrradianceKey(lat, lon);

        // Return cached result to avoid redundant PVGIS calls for the same location
        var cached = await _cache.GetAsync<IrradianceResult>(cacheKey);
        if (cached is not null) return cached;

        // PVGIS perrpar endpoint: yearly totals for horizontal irradiance
        var url = $"/api/v5_2/seriescalc?lat={lat}&lon={lon}&outputformat=json" +
                  $"&startyear=2020&endyear=2020&pvcalculation=0";

        var response = await _http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadAsStringAsync(ct);

        double irradiance;
        try
        {
            // PVGIS returns hourly series — we sum to get annual kWh/m²
            using var doc = JsonDocument.Parse(json);
            var outputs = doc.RootElement.GetProperty("outputs");
            var hourly = outputs.GetProperty("hourly");

            double sum = 0;
            foreach (var hour in hourly.EnumerateArray())
                sum += hour.GetProperty("G(h)").GetDouble(); // Global horizontal irradiance W/m²

            // Convert Wh/m² annual sum to kWh/m²
            irradiance = Math.Round(sum / 1000, 1);
        }
        catch
        {
            return null;
        }

        var result = new IrradianceResult(
            Latitude: lat,
            Longitude: lon,
            Address: null,
            IrradianceKwhM2: irradiance,
            IncreaseDecreaseRate: null,
            InverterCountryApproval: false,
            FeedInLimitPercent: null,
            DisplacementPowerFactor: 1.0
        );

        await _cache.SetAsync(cacheKey, result);
        return result;
    }
}