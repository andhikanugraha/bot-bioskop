const InMemoryDataStore = require('./InMemoryDataStore');
const NeDBDataStore = require('./NeDBDataStore.js');
const XxiConnector = require('./XxiConnector');
const BlitzConnector = require('./BlitzConnector');
const moment = require('moment'); require('moment-timezone');

let providerConnectors = [XxiConnector, BlitzConnector];
let dataStore = new NeDBDataStore();

let CinemaCore = {
  providerConnectors,
  dataStore,
  providers: providerConnectors
        .map(constructor => new constructor(dataStore)),

  refreshTimer: null,

  init() {
    return Promise
      .all(CinemaCore.providers.map(provider => provider.init()))
      .then(() => {
        let now = moment().tz('Asia/Jakarta');
        let midnight = moment(now).startOf('day').add(1, 'day');
        let morning = moment(now).startOf('day').add(7, 'hours');
        let msToMidnight = midnight.diff(now);
        let msToMorning = morning.diff(now);
        let timeout = (msToMorning < 0) ? msToMidnight : msToMorning;

        CinemaCore.refreshTimer = setTimeout(CinemaCore.refresh, timeout);
      });
  },

  lazyInit() {
    return CinemaCore.isInitialized().then(isInit => {
      if (!isInit) {
        return CinemaCore.init().then(() => CinemaCore);
      } else {
        return CinemaCore;
      }
    });
  },

  isInitialized() {
    return CinemaCore.getLoadedCities().then(cities => cities.size !== 0);
  },

  flush() {
    return CinemaCore.dataStore.flush();
  },

  refresh() {
    return CinemaCore.getLoadedCities().then(previouslyLoadedCities => {
      previouslyLoadedCities = [...previouslyLoadedCities];

      return CinemaCore.flush()
        .then(() => CinemaCore.init())
        .then(() => {
          return Promise.all(previouslyLoadedCities.map(CinemaCore.loadCity))
            .then(() => previouslyLoadedCities);
        });
    });
  },

  getLoadedCities() {
    return CinemaCore.findScreenings().then(screenings => {
      let cityNames = new Set;
      for (let screening of screenings) {
        cityNames.add(screening.cityName);
      }
      return cityNames;
    });
  },

  isCityLoaded(cityName) {
    cityName = cityName.trim().toUpperCase();
    return CinemaCore.getLoadedCities()
      .then(cities => cities.has(cityName));
  },

  loadCity(cityName) {
    cityName = cityName.trim().toUpperCase();
    return CinemaCore.lazyInit()
    .then(() => CinemaCore.isCityLoaded(cityName))
    .then(isLoaded => {
      if (isLoaded) {
        return;
      } else {
        let loadPromises = Promise.all(CinemaCore.providers.map(
          provider => provider.loadCity(cityName)
        ));

        return loadPromises;
      }
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
    return new RegExp(needle.replace(/ /g, '.+'));
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

  makeScreeningQuery({
    cityName, theatreName, filmTitle, variant, date, time
  }) {
    date = date || moment().format('YYYY-MM-DD');
    time = time || '00:00';

    let query = {
      date: {$lte: date},
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

    return query;
  },

  getScheduleTree(params) {
    let query = CinemaCore.makeScreeningQuery(params);

    let firstKeyProperty;
    if (typeof query.theatreName === 'string') {
      firstKeyProperty = 'filmTitle';
    } else if (typeof query.filmTitle === 'string') {
      firstKeyProperty = 'theatreName';
    }

    return CinemaCore.findScreenings(query)
    .then(screenings => {
      let schedule = new Map;

      // Handle date discrepancy (XXI)
      let latestDateByProvider = new Map;
      for (screening of screenings) {
        let {providerId, date} = screening;
        let existingDate = latestDateByProvider.get(providerId);
        if (!existingDate || existingDate < date) {
          latestDateByProvider.set(providerId, date);
        }
      }

      for (screening of screenings) {
        let {providerId, date, variant, time, priceIdr} = screening;
        if (date !== latestDateByProvider.get(providerId)) {
          continue;
        }

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
