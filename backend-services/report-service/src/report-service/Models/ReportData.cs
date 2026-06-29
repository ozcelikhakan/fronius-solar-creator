namespace report_service.Models;

public record ReportData(
    // Cover + customer page
    string ProjectName,
    string CustomerFirstName,
    string CustomerLastName,
    string? CustomerCompany,
    string? CustomerEmail,
    string ProjectDate,

    // Location
    double Latitude,
    double Longitude,
    string? Address,
    double IrradianceKwhM2,

    // PV System
    double PeakPowerKwp,
    double YearlyYieldKwh,
    double SelfConsumptionRate,
    double SelfSufficiencyRate,
    double PerformanceRatio,

    // Profitability
    double SavingsPerYear,
    double FeedInRevenue,
    double ReturnOnInvestmentMonths,
    double Co2SavingsKgPerYear,
    double TotalSystemCostEur,

    // Charts data
    List<MonthlyReportData> MonthlyData,
    List<AmortizationReportData> AmortizationData
);

public record MonthlyReportData(int Month, double ProductionKwh, double ConsumptionKwh);

public record AmortizationReportData(int Year, double CumulativeSavings, double CumulativeCost);