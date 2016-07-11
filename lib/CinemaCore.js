const InMemoryDataStore = require('./InMemoryDataStore');
const XxiConnector = require('./XxiConnector');
const BlitzConnector = require('./BlitzConnector');
const moment = require('moment'); require('moment-timezone');

let CinemaCore = {
  providerConnectors: [XxiConnector, BlitzConnector],
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

  isCityLoaded(cityName) {
    cityName = cityName.trim().toUpperCase();
    return CinemaCore.loadedCities.has(cityName);
  },

  loadCity(cityName) {
    cityName = cityName.trim().toUpperCase();
    if (CinemaCore.loadedCities.has(cityName)) {
      return;
    }

    let loadPromises =
      Promise.all(CinemaCore.providers
        .map(provider => provider.loadCity(cityName)));

    return loadPromises.then(() => {
      console.log(`Finished loading ${cityName}`);
      CinemaCore.loadedCities.add(cityName);
    });
  },

  // find* functions from dataStore
  findCities(...args) {
    return CinemaCore.dataStore.findCities(...args);
  },

  findTheatres(...args) {
    return CinemaCore.dataStore.findTheatres(...args);
  },

  findFilms(...args) {
    return CinemaCore.dataStore.findFilms(...args);
  },

  findScreenings(...args) {
    return CinemaCore.dataStore.findScreenings(...args);
  },

  findKeywords(...args) {
    return CinemaCore.dataStore.findKeywords(...args);
  },

  // string cleaning & matching
  cleanString(str) {
    return str
      .trim()
      .replace(/\s+/g, ' ')
      // .replace(/[^a-zA-Z0-9 ]/g, '')
      .toUpperCase();
  },

  stringToSearchPattern(needle) {
    needle = CinemaCore.cleanString(needle);
    return new RegExp(needle.replace(/ /g, '.+'))
  },

  getCityNames() {
    return CinemaCore.findCities()
      .then(cityObjects => {
        let cityNames = [...cityObjects].map(obj => obj.cityName);
        return cityNames;
      });
  },

  getTheatre(query) {
    if (typeof query === 'string') {
      query = {theatreName: query};
    }

    return CinemaCore.findTheatres(query)
      .then(theatres => [...theatres][0]);
  },

  getTheatresInCity(cityName) {
    return CinemaCore.findTheatres({cityName});
  },

  getAvailableFilms(query) {
    return Promise.all([
      CinemaCore.findScreenings(query),
      CinemaCore.findFilms()
    ]).then(([screenings, films]) => {
      let availableFilmTitles = new Set;
      for (let screening of screenings) {
        availableFilmTitles.add(screening.filmTitle);
      }

      let availableFilms = new Set;
      for (let film of films) {
        if (availableFilmTitles.has(film.filmTitle)) {
          availableFilms.add(film);
        }
      }

      return availableFilms;
    });
  },

  resolveKeyword({keyword, type, allowAmbiguous}) {
    let keywordStd = CinemaCore.cleanString(keyword);
    let keywordRegex = CinemaCore.stringToSearchPattern(keyword);

    let query = {keyword: keywordRegex};
    if (type) {
      query.type = type;
    }

    return CinemaCore.findKeywords(query)
    .then(keywords => {
      if (!allowAmbiguous) {
        return [...keywords][0];
      } else if (type && keywords.size > 1) {
        for (let keywordObj of keywords) {
          if (keywordObj.keyword === keywordStd) {
            return new Set().add(keywordObj);
          }
        }
        return keywords;
      } else {
        return keywords;
      }
    });
  },

  getScheduleTree({cityName, theatreName, filmTitle, variant, date, time}) {
    date = date || moment().format('YYYY-MM-DD');
    time = time || '00:00';

    let query = {
      date,
      time: {$gte: time}
    };

    if (variant) {
      query.variant = variant;
    }
    if (filmTitle) {
      query.filmTitle = filmTitle;
    }
    if (theatreName) {
      query.theatreName = theatreName;
    }
    if (cityName) {
      query.cityName = cityName;
    }

    let firstKeyProperty;
    if (typeof theatreName === 'string') {
      firstKeyProperty = 'filmTitle';
    } else if (typeof filmTitle === 'string') {
      firstKeyProperty = 'theatreName';
    }

    return CinemaCore.findScreenings(query)
    .then(screenings => {
      let schedule = new Map;

      for (screening of screenings) {
        let {variant, time, priceIdr} = screening;

        let firstKey = screening[firstKeyProperty];
        if (!schedule.get(firstKey)) {
          schedule.set(firstKey, new Map);
        }
        if (!schedule.get(firstKey).get(variant)) {
          schedule.get(firstKey).set(variant, {
            times: [],
            price: 0
          });
        }
        if (!schedule.get(firstKey).get(variant).price) {
          schedule.get(firstKey).get(variant).price = priceIdr;
        }

        let times = schedule.get(firstKey).get(variant).times;
        times.push(time);
        times.sort();
      }

      return schedule;
    });
  },
};

module.exports = CinemaCore;
