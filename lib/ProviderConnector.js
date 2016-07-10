class ProviderConnector {
  constructor(dataStore) {
    this.dataStore = dataStore;
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
    this.dataStore.addScreening(screening);
    this.registerFilm(screening.filmTitle);
  }

  init() {}
  loadCity(cityName) {}
}

module.exports = ProviderConnector;
