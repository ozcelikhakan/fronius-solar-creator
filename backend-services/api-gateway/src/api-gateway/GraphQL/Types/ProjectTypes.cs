namespace api_gateway.GraphQL.Types;

public record ProjectDto(
    string Id,
    string Name,
    string? CustomerFirstName,
    string? CustomerLastName,
    string? CustomerEmail,
    string? CustomerCompany,
    string Currency,
    string MeasurementSystem,
    string TemperatureUnit,
    string CableStandard,
    List<string> ProjectTypes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record LocationDto(
    double Latitude,
    double Longitude,
    string? Address,
    double IrradianceKwhM2,
    double? IncreaseDecreaseRate,
    bool InverterCountryApproval,
    double? FeedInLimitPercent,
    double DisplacementPowerFactor
);

public record SimulationResultDto(
    double YearlyYieldKwh,
    double SelfConsumptionRate,
    double SelfSufficiencyRate,
    double PerformanceRatio,
    double SavingsPerYear,
    double FeedInRevenue,
    double ReturnOnInvestmentMonths,
    double Co2SavingsKgPerYear
);

public record LoginInput(string Email, string Password);
public record LoginPayload(string Token, string UserId, string Email);

public record CreateProjectInput(
    string Name,
    string? CustomerFirstName,
    string? CustomerLastName,
    string? CustomerEmail,
    string? CustomerCompany,
    string? CustomerPhone,
    string Currency,
    string MeasurementSystem,
    string TemperatureUnit,
    string CableStandard,
    List<string> ProjectTypes
);