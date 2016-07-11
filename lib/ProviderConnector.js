class ProviderConnector {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  standardizeTitle(title) {
    return title.replace(/ dan /ig, ' & ').toUpperCase();
  }

  registerCity(cityObj) {
    cityObj.cityName = cityObj.cityName.toUpperCase();

    return this.dataStore.addCity(cityObj)
    .then(() => this.dataStore.addKeyword({
      keyword: cityObj.cityName,
      type: 'city'
    }));
  }

  registerFilm(filmObj) {
    filmObj.filmTitle = filmObj.filmTitle.toUpperCase();

    return this.dataStore.addFilm(filmObj)
    .then(() => this.dataStore.addKeyword({
      keyword: filmObj.filmTitle,
      type: 'film'
    }));
  }

  registerTheatre(theatreObj) {
    theatreObj.theatreName = theatreObj.theatreName.toUpperCase();
    theatreObj.providerId = this.providerId;

    return this.dataStore.addTheatre(theatreObj)
    .then(() =>this.dataStore.addKeyword({
      keyword: theatreObj.theatreName,
      type: 'theatre'
    }));
  }

  registerScreening(screeningObj) {
    screeningObj.filmTitle = this.standardizeTitle(screeningObj.filmTitle);
    screeningObj.providerId = this.providerId;
    return this.dataStore.addScreening(screeningObj);
  }

  findCities(...args) {
    return this.dataStore.findCities(...args);
  }

  findTheatres(...args) {
    return this.dataStore.findTheatres(...args);
  }

  findFilms(...args) {
    return this.dataStore.findFilms(...args);
  }

  findScreenings(...args) {
    return this.dataStore.findScreenings(...args);
  }

  findKeywords(...args) {
    return this.dataStore.findKeywords(...args);
  }

  init() {}
  loadCity(cityName) {}
}

module.exports = ProviderConnector;
