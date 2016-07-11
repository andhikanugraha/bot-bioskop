// // Set of screenings. Should be flushed every night
// let screenings = new Set;
// // { providerId, city, theatreName, theatreId, filmTitle, filmId, variant, date, time, priceIdr }

// // Set of theatres
// let theatres = new Map;
// // { city, theatreName, providerId, theatreId, address }

// // Set of films
// let films = new Set;
// // strings.
// // For XXI, sanitize 2D/3D/IMAX identifiers

// let cities = new Set;
// // strings.

const qry = require('qry');

class InMemoryDataStore {
  constructor() {
    this.cities = new Set;
    this.films = new Set;
    this.theatres = new Set;
    this.screenings = new Set;
    this.keywords = new Set;
  }

  flush() {
    this.cities.clear();
    this.films.clear();
    this.screenings.clear();
    this.theatres.clear();
    return Promise.resolve();
  }

  insertOrUpdate(set, query, item) {
    return this.findIn(set, query).then(items => {
      if (items.size > 0) {
        Object.assign([...items][0], item);
      } else {
        set.add(item);
      }
    });
  }

  addCity(cityObj) {
    let {cityName} = cityObj;
    return this.insertOrUpdate(this.cities, {cityName}, cityObj);
  }

  addFilm(filmObj) {
    let {filmTitle} = filmObj;
    return this.insertOrUpdate(this.films, {filmTitle}, filmObj);
  }

  addTheatre(theatreObj) {
    let {theatreName} = theatreObj;
    return this.insertOrUpdate(this.theatres, {theatreName}, theatreObj);
  }

  addScreening(screeningObj) {
    return this.insertOrUpdate(this.screenings, screeningObj, screeningObj);
  }

  addKeyword(keywordObj) {
    let {keyword} = keywordObj;
    return this.insertOrUpdate(this.keywords, {keyword}, keywordObj);
  }

  findIn(set, query = {}) {
    return new Promise((resolve) => {
      let match = qry(query);
      let output = new Set;
      for (let item of set) {
        if (match(item)) {
          output.add(item);
        }
      }

      resolve(output);
    });
  }

  findCities(...args) {
    return this.findIn(this.cities, ...args);
  }

  findTheatres(...args) {
    return this.findIn(this.theatres, ...args);
  }

  findFilms(...args) {
    return this.findIn(this.films, ...args);
  }

  findScreenings(...args) {
    return this.findIn(this.screenings, ...args);
  }

  findKeywords(...args) {
    return this.findIn(this.keywords, ...args);
  }
}

module.exports = InMemoryDataStore;
