class ProviderConnector {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  standardizeTitle(title) {
    return title.replace(/ dan /ig, ' & ').toUpperCase();
  }

  registerCity(cityObj) {
    cityObj.cityName = cityObj.cityName.toUpperCase();
    return this.dataStore.addCity(cityObj);
  }

  registerFilm(filmObj) {
    filmObj.filmTitle = filmObj.filmTitle.toUpperCase();
    return this.dataStore.addFilm(filmObj);
  }

  registerTheatre(theatreObj) {
    theatreObj.theatreName = theatreObj.theatreName.toUpperCase();
    theatreObj.providerId = this.providerId;
    return this.dataStore.addTheatre(theatreObj);
  }

  registerScreening(screeningObj) {
    screeningObj.filmTitle = this.standardizeTitle(screeningObj.filmTitle);
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

  init() {}
  loadCity(cityName) {}
}

module.exports = ProviderConnector;
