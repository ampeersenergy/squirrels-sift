const to2fR = float => Math.round((float + Number.EPSILON) * 100) / 100;
const to6fR = float => Math.round((float + Number.EPSILON) * 1000000) / 1000000;

// stolen from co2.js
// this refers to the estimated total energy use for the internet is around 2000 TWh,
// divided by the total transfer it enables, which is around 2500 exabytes
const KWH_PER_GB = 0.81;

/**
 * Carbon intensity values for different components involved in a digital service.
 * Measured in grams of CO2 equivalent per kilowatt-hour (g/kWh).
 *
 * @typedef {Object} GridIntensities
 * @property {number} dataCenter - Carbon intensity for the location of the data center.
 * @property {number} network - Carbon intensity for the network, including data transmission.
 * @property {number} device - Carbon intensity for the user's device accessing the service.
 * @property {number} production - Carbon intensity for the production of the user's device.
 */
const _gridIntensities = {
  dataCenter: 50,
  network: 437.26,
  device: 437.26,
  production: 437.26,
};

//Percentage of the total energy use for each part. Yes, they add up to 100.
const _contributions = {
  dataCenter: 14,
  network: 14,
  device: 53,
  production: 19,
};

/**
 * Calculates the total CO2 emissions per week for a given package size and number of downloads.
 *
 * @param {number} sizeKb - The size of the package in kilobytes.
 * @param {number} downloads - The number of downloads per week.
 * @param {Object} gridIntensities - An object containing the carbon intensity of different components. Defaults to `_gridIntensities`.
 * @param {Object} contributions - An object containing the contribution of different components. Defaults to `_contributions`.
 * @returns {Object} Returns an object containing the total CO2 emissions per week in kilograms and the total energy consumption in kilowatt-hours.
 */
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

/**
 * Calculates the total CO2 emissions and energy consumption per week for a given package size and number of downloads.
 * 
 * @param {number} sizeKb - The size of the package in kilobytes.
 * @param {number} downloadsLastWeek - The number of downloads last week.
 * @returns {Object} Returns an object containing the total energy consumption and CO2 emissions per week in kilowatt-hours, kilograms, and tonnes.
 */
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