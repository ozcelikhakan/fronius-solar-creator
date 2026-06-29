namespace weather_service.Models;

//Returned to API Gateway - mirrors LocationDTO shape so gateway can forward it directly 

public record IrradianceResult(
    double Latitude,
    double Longitude,
    string? Address,
    double IrradianceKwhM2,        //Annual global horizontal irradiance from pvgıs
    double? IncreaseDecreaseRate,  //Always null here - user sets this in the UI slider
    bool InverterCountryApproval,  //Default false - user toggles in location step
    double? FeedInLimitPercent,    //Default null - user sets in location step
    double DisplacementPowerFactor //Default 1.0 - user adjust in location step
);

// Raw PVGIS API response shape - only the fields we need from the full response
public record PvgisResponse(PvgisOutputs Outputs);
public record PvgisOutputs(PvgisTotals Totals);
public record PvgisTotals(PvgisMonthly Total);

//H(h)_m: monthly average of global horizontal irradiance sum  (kwh/m2)
public record PvgisMonthly(double H_h_m_year);

