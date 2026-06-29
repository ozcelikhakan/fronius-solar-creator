using System.Diagnostics.Contracts;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace project_service.Models;

public class Project

{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Name { get; set; } = string.Empty;

    //Installer/customer fields collected in wizard step 1/3
    public string? CustomerFirstName { get; set; }
    public string? CustomerLastName { get; set; }
    public string? CustomerEmail { get; set; }
    public string? CustomerCompany { get; set; }
    public string? CustomerPhone { get; set;}

    //Unit system preferences set in wizard step 3/3

    public string Currency { get; set; } = "EUR";
    public string MeasurementSystem { get; set; } = "Metric";
    public string TemperatureUnit { get; set; } = "Celcius";
    public string CableStandard { get; set; } = "ISO";

    //Multi-select from wizard step 2/3 - drives which sub-steps appear (Battery, E-Mobility..)

    public List<string> ProjectTypes { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    //UpdatedAt refreshed on every patch so apı gateway always returns fresh data
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}