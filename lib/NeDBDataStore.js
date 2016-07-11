let NeDB = require('nedb-promise');

class NeDBDataStore {
  constructor() {
    [
      ['cities', 'cityName'],
      ['films', 'filmTitle'],
      ['theatres', 'theatreName'],
      ['screenings'],
      ['keywords', 'keyword']
    ].forEach(collection => {
      this.db(...collection).then(db => this[collection[0]] = db);
    });
  }

  db(collectionName, uniqueConstraint) {
    let basePath = './data';
    let db = new NeDB(basePath + '/' + collectionName + '.ldjson');
    return db.loadDatabase().then(() => {
      if (uniqueConstraint) {
        return db.ensureIndex({
          fieldName: uniqueConstraint,
          unique: true
        }).then(() => db);
      } else {
        return db;
      }
    });
  }

  flush() {
    let multi = true;
    return Promise.all([
      this.cities.remove({}, {multi}),
      this.films.remove({}, {multi}),
      this.screenings.remove({}, {multi}),
      this.theatres.remove({}, {multi})
    ]).then(() => {
      this.cities.persistence.compactDatafile();
      this.films.persistence.compactDatafile();
      this.screenings.persistence.compactDatafile();
      this.theatres.persistence.compactDatafile();
    });
  }

  insertOrUpdate(set, query, item) {
    return set.count(query).then(count => {
      if (count > 0) {
        return set.update(query, {$set: item});
      } else {
        return set.insert(item).catch(() => {});
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

  findIn(set, query = {}, ...args) {
    return set.find(query, ...args)
      .then(items => new Set(items));
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

module.exports = NeDBDataStore;
