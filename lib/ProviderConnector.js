class ProviderConnector {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  standardizeTitle(title) {
    return title.replace(/ dan /ig, ' & ');
  }

  registerCity(cityName) {
    this.dataStore.addCity(cityName);
  }

  registerFilm(filmTitle) {
    this.dataStore.addFilm(filmTitle);
  }

  registerTheatre(theatre) {
    theatre.providerId = this.providerId;
    this.dataStore.addTheatre(theatre);
  }

  registerScreening(screening) {
    screening.filmTitle = this.standardizeTitle(screening.filmTitle);
    this.dataStore.addScreening(screening);
    this.registerFilm(screening.filmTitle);
  }

  init() {}
  loadCity(cityName) {}
}

module.exports = ProviderConnector;
