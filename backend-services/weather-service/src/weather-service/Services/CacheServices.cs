using System.Text.Json;
using StackExchange.Redis;

namespace weather_service.Services;

// Wraps Redis so callers never touch the raw driver — swappable for IMemoryCache in tests
public class CacheService
{
    private readonly IDatabase _db;
    private readonly int _ttlHours;

    public CacheService(IConfiguration config)
    {
        var conn = ConnectionMultiplexer.Connect(config["Redis:ConnectionString"]!);
        _db = conn.GetDatabase();
        _ttlHours = int.Parse(config["PVGIS:CacheTtlHours"] ?? "24");
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        var value = await _db.StringGetAsync(key);
        if (value.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>((string)value!);
    }

    public async Task SetAsync<T>(string key, T value)
    {
        var json = JsonSerializer.Serialize(value);
        // TTL prevents stale irradiance data from being served indefinitely
        await _db.StringSetAsync(key, json, TimeSpan.FromHours(_ttlHours));
    }

    // Key includes rounded coordinates to maximize cache hits for nearby locations
    public static string IrradianceKey(double lat, double lon) =>
        $"irradiance:{Math.Round(lat, 3)}:{Math.Round(lon, 3)}";
}