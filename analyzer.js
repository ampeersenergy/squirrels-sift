const to2fR = float => Math.round((float + Number.EPSILON) * 100) / 100;
const to6fR = float => Math.round((float + Number.EPSILON) * 1000000) / 1000000;

// stolen from co2.js
// this refers to the estimated total energy use for the internet around 2000 TWh,
// divided by the total transfer it enables around 2500 exabytes
const KWH_PER_GB = 0.81;
const _gridIntensities = {
  dataCenter: 50,
  network: 437.26,
  device: 437.26,
  production: 437.26,
};
const _contributions = {
  dataCenter: 15,
  network: 14,
  device: 53,
  production: 19,
};
function calculateCO2Emissions(sizeKb, downloads, gridIntensities = _gridIntensities, contributions = _contributions) {
  // Convert size from kB to GB
  const sizeGb = sizeKb / 1_000_000;

  // Calculate the total CO2 emissions per GB for each part
  let totalCo2PerGb = 0;
  for (const part in gridIntensities) {
    const intensity = gridIntensities[part];
    const contribution = contributions[part] / 100;
    totalCo2PerGb += intensity * contribution;
  }

  // Calculate the CO2 emissions per download in grams
  const co2EmissionsPerDownloadG = sizeGb * totalCo2PerGb;

  // Calculate the total CO2 emissions for all downloads in a week in grams
  const totalCo2EmissionsWeekG = co2EmissionsPerDownloadG * downloads;

  // Convert the total weekly emissions from grams to kilograms
  const totalCo2EmissionsWeekKg = totalCo2EmissionsWeekG / 1000;

  return { totalCo2EmissionsWeekKg, consumedkWh: sizeGb * KWH_PER_GB };
}

// size of PKG (GB) = n kB / 1,000,000 kB/GB
// CO2 emissions per download (kg) = Size of PKG (GB) × 5kWh/GB × 0.5kg CO2/kWh
// total CO2 emissions (kg/week) = CO2 emissions per download (kg) × x weekly downloads
function emissionPerWeek(sizeKb, downloadsLastWeek) {
  const emissions = calculateCO2Emissions(sizeKb, downloadsLastWeek);
  return {
    consumedkWh: to6fR(emissions.consumedkWh * downloadsLastWeek),
    kg: to6fR(emissions.totalCo2EmissionsWeekKg),
    t: to2fR((emissions.totalCo2EmissionsWeekKg) / 1000),
  };
}

module.exports = {
  emissionPerWeek,
};