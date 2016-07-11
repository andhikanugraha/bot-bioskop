const InMemoryDataStore = require('./InMemoryDataStore');
const XxiConnector = require('./XxiConnector');
const BlitzConnector = require('./BlitzConnector');
const moment = require('moment'); require('moment-timezone');

let CinemaCore = {
  providerConnectors: [XxiConnector],
  dataStore: new InMemoryDataStore(),
  loadedCities: new Set,
  refreshTimer: null,

  init() {
    CinemaCore.providers =
      CinemaCore.providerConnectors
        .map(constructor => new constructor(CinemaCore.dataStore));

    return Promise
      .all(CinemaCore.providers.map(provider => provider.init()))
      .then(() => {
        let now = moment().tz('Asia/Jakarta');
        let midnight = moment(now).startOf('day').add(1, 'day');
        let msToMidnight = midnight.diff(now);

        CinemaCore.refreshTimer = setTimeout(CinemaCore.refresh, msToMidnight);
      });
  },

  flush() {
    CinemaCore.providers = [];
    CinemaCore.loadedCities.clear();
    return CinemaCore.dataStore.flush();
  },

  refresh() {
    let previouslyLoadedCities = [];
    CinemaCore.loadedCities
      .forEach(cityName => previouslyLoadedCities.push(cityName));

    return CinemaCore.flush()
      .then(() => CinemaCore.init())
      .then(() => {
        return Promise.all(previouslyLoadedCities.map(CinemaCore.loadCity));
      });
  },

  loadCity(cityName) {
    console.log(`Loading ${cityName}...`);
    cityName = cityName.trim().toUpperCase();
    if (CinemaCore.loadedCities.has(cityName)) {
      return;
    }

    let throbber = setInterval(() => {
      console.log(`Still loading ${cityName}...`);
    }, 3000);

    let loadPromises =
      Promise.all(CinemaCore.providers
        .map(provider => provider.loadCity(cityName)));

    return loadPromises.then(() => {
      clearInterval(throbber);
      console.log(`Finished loading ${cityName}`);
      CinemaCore.loadedCities.add(cityName);
    });
  },

  getScheduleByFilmAndCity(cityName, filmTitle,
                                  date=moment().format('YYYY-MM-DD'),
                                  time='00:00') {
    let schedule = new Map;
      // Map of Map of Array of string
      // level 1: theatre
      // level 2: variant
      // level 3: time

    for (let screening of CinemaCore.dataStore.screenings) {
      if (screening.city === cityName &&
          screening.filmTitle === filmTitle &&
          screening.date === date &&
          screening.time >= time) {
        let {theatreName, variant, time, priceIdr} = screening;
        if (!schedule.get(theatreName)) {
          schedule.set(theatreName, new Map);
        }
        if (!schedule.get(theatreName).get(variant)) {
          schedule.get(theatreName).set(variant, {
            times: [],
            price: 0
          });
        }
        if (!schedule.get(theatreName).get(variant).price) {
          schedule.get(theatreName).get(variant).price = priceIdr;
        }

        let times = schedule.get(theatreName).get(variant).times;
        times.push(time);
        times.sort();
      }
    }

    return schedule;
  }
};

module.exports = CinemaCore;
