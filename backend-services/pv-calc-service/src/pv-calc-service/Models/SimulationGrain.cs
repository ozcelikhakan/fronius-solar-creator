namespace pv_calc_service.Models;

//All data collected across wizard steps 1-4 needed to run the PV simulation

public record SimulationInput(
    string ProjectId,

    //Step 1 - Location
    double IrradianceKwhM2, // Annual solar resource from PVGIS 
    double FeedInLimitPercent, // Grid export cap set by utility

    //Step 2 - Consumption
    double AnnualConsumptionKwh, // Total household yearly demand

    //Step 3 - PV Arrays(aggregated)
    double PeakPowerKwp, // Sum of all array peak powers
    double ModuleTiltDeg, // Average titl across arrays

    //Step 4 - Inverter selection
    double InverterNominalPowerKw,

    //Step 5 - Battery (optional)
    double BatteryCapacityKwh, //0 if no battery selected

    //Step 6 - Profitability inputs
    double ElectricityCostEurKwh,
    double FeedInTariffEurKwh,
    double TotalSystemCostEur,
    int CalculationPeriodYears
);