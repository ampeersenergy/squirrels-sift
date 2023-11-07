const { resolve } = require('path');
const { readFile, writeFile } = require('fs/promises');
const { program } = require('commander');
const npm = require('npm-stats-api');
const { emissionPerWeek } = require('./analyzer');

/**
 * Handles npm package version listings. Fetches the statistics and details of each package, and calculates the emissions per week.
 *
 * @async
 * @param {Array} npmPackageVersionListings - An array of objects, each containing the name and version of an npm package. The version defaults to 'latest' if not provided.
 * @param {boolean} [ignoreDownloads=false] - If set to true, the function will ignore the number of downloads when calculating emissions per week.
 * @returns {Promise<Array>} Returns a Promise that resolves to an array of objects. Each object contains the name, version, stat, details, and emissionsPerWeek of a package. If there was an error fetching the stat or details of a package, the corresponding property will be null and an error property will be added to the object.
 * @example
 * const npmPackageVersionListings = [
 *   { name: 'express', version: '4.17.1' },
 *   { name: 'react', version: '17.0.2' },
 * ];
 *
 * npmPackagesHandler(npmPackageVersionListings, true)
 *   .then(results => console.log(results))
 *   .catch(error => console.error(error));
 */
async function npmPackagesHandler(timespan, npmPackageVersionListings, ignoreDownloads = false) {
  const promises = npmPackageVersionListings.map(({ name, version = 'latest' }) => {
    const statPromise = npm.stat(name, timespan.start, timespan.end);
    const detailsPromise = fetch(`https://bundlephobia.com/api/size?package=${name}@${version}`).then(res => res.json());

    return Promise.allSettled([statPromise, detailsPromise]).
      then(([statResult, detailsResult]) => {
        const result = { name, version };

        if (statResult.status === 'fulfilled') {
          result.stat = statResult.value;
        } else {
          result.stat = null;
          result.error = statResult.reason;
        }

        if (detailsResult.status === 'fulfilled') {
          result.details = detailsResult.value;
          result.emissionsPerWeek = emissionPerWeek(result.details.size / 1000, ignoreDownloads ? 1 : result.stat?.body.downloads);
        } else {
          result.details = null;
          result.error = detailsResult.reason;
        }

        return result;
      });
  });

  const results = await Promise.all(promises);
  return results;
}

/**
 * Handles the result of npm package processing.
 *
 * This function takes the results of processing npm packages, which includes their name, version, and calculated emissions per week.
 * If the 'condensed' option is set, it aggregates the emissions and details of all packages into a single object.
 * If the 'out' option is set, it writes the result to a specified file. Otherwise, it logs the result to the console.
 *
 * @async
 * @param {Object} options - An object containing the options for handling the result. Options include 'condensed' and 'out'.
 * @param {Array} result - An array of objects, each containing the name, version, and emissionsPerWeek of a package.
 */
async function resultHandler(options, result) {
  // If the 'condensed' option is true, reduce the result array to a single object.
  // This object contains the total emissions and an array of details for each package.
  // If the 'condensed' option is false, leave the result as is.
  const _result = options.condensed
    ? result.reduce((acc, currentPackage, idx, _array) => {
      const isLast = idx === _array.length - 1;

      const emissions_kg = currentPackage?.emissionsPerWeek?.kg ?? 0;
      const consumption_kWh = currentPackage?.emissionsPerWeek?.consumedkWh ?? 0;
      const obj = {
        name: currentPackage.name,
        version: currentPackage.version,
        emissions_kg: Number.isNaN(emissions_kg) ? 0 : emissions_kg,
        consumption_kWh: Number.isNaN(consumption_kWh) ? 0 : consumption_kWh,
      };
      //console.log(obj);

      // Add the emissions of the current package to the total emissions.
      acc.aggregatedEmissions_kg += obj.emissions_kg;

      // Add the consumption of the current package to the total consumption.
      acc.aggregated_kWh += obj.consumption_kWh;

      if (isLast) {
        acc.flights_LDN_JFK = Math.floor(acc.aggregatedEmissions_kg / 590);
      }

      // Add the details of the current package to the details array.
      acc.details.push(obj);

      return acc;
    }, { aggregatedEmissions_kg: 0, aggregated_kWh: 0, flights_LDN_JFK: 0, timespan: options.baseTime, details: [] })
    : result;

  console.dir(_result, { depth: null });

  // If the 'out' option is provided, write the result to a file.

  if (options.out) {
    const fullPath = resolve(options.out);
    await writeFile(fullPath, JSON.stringify(_result, null, 2), 'utf8');
  }
}

async function npmHandler(options) {
  const npmList = options.npm === '' ? [] : options.npm.split(',');
  const co2Listings = await npmPackagesHandler(options.baseTime, npmList.map(_ => ({ name: _ })));
  await resultHandler(options, co2Listings);
}

async function repohandler(options) {
  const { repo } = options;
  const fullPath = resolve(repo);
  const packageJSONFile = await readFile(`${fullPath}/package.json`, 'utf8');
  const packageJSON = JSON.parse(packageJSONFile);

  const npmPackageVersionListings = Object.entries(packageJSON.dependencies).map(([name, version]) => ({ name, version }));
  const result = await npmPackagesHandler(options.baseTime, npmPackageVersionListings, true);

  await resultHandler(options, result);
}

function getLastMonthStartAndEnd(now = new Date()) {
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 2);

  const format = date => date.toISOString().split('T')[0];

  return {
    start: format(lastMonthStart),
    end: format(lastMonthEnd),
  };
}

async function cli() {
  program.
    option('--base-time <from>', 'base timestamp (YYYY-MM-DD), defaults to last month', getLastMonthStartAndEnd()).
    option('--npm <list>', 'list npm modules to check', '').
    option('--repo <path>', 'check your repos modules', '').
    option('--out <path>', 'your result path', '').
    option('--condensed', 'condense results', '').
    parse();

  const options = program.opts();
  options.baseTime = typeof options.baseTime === 'string'
    ? getLastMonthStartAndEnd(new Date(options.baseTime))
    : options.baseTime;
  await options.npm !== ''
    ? npmHandler(options)
    : repohandler(options);
}
cli();