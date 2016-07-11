class ProviderConnector {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  standardizeTitle(title) {
    return title.replace(/ dan /ig, ' & ').toUpperCase();
  }

  registerCity(cityObj) {
    cityObj.cityName = cityObj.cityName.toUpperCase();

    return Promise.all([
      this.dataStore.addCity(cityObj),
      this.dataStore.addKeyword({
        keyword: cityObj.cityName,
        type: 'film'
      })
    ]);
  }

  registerFilm(filmObj) {
    filmObj.filmTitle = filmObj.filmTitle.toUpperCase();

    return Promise.all([
      this.dataStore.addFilm(filmObj),
      this.dataStore.addKeyword({
        keyword: filmObj.filmTitle,
        type: 'film'
      })
    ]);
  }

  registerTheatre(theatreObj) {
    theatreObj.theatreName = theatreObj.theatreName.toUpperCase();
    theatreObj.providerId = this.providerId;

    return Promise.all([
      this.dataStore.addTheatre(theatreObj),
      this.dataStore.addKeyword({
        keyword: theatreObj.theatreName,
        type: 'theatre'
      })
    ]);
  }

  registerScreening(screeningObj) {
    screeningObj.filmTitle = this.standardizeTitle(screeningObj.filmTitle);
    return Promise.all([
      this.dataStore.addScreening(screeningObj),
      this.registerFilm({filmTitle: screeningObj.filmTitle}),
      this.registerTheatre({theatreName: screening.theatreName})
    ]);
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
