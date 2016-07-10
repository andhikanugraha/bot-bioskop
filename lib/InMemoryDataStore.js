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



class InMemoryDataStore {
  constructor() {
    this.cities = new Set;
    this.films = new Set;
    this.theatres = new Set;
    this.screenings = new Set;
  }

  addCity(cityName) {
    this.cities.add(cityName.trim().toUpperCase());
  }

  addFilm(filmTitle) {
    this.films.add(filmTitle.trim().toUpperCase());
  }

  addTheatre(theatre) {
    this.theatres.set(theatre.theatreName.toUpperCase(), threatre);
  }

  addScreening(screening) {
    this.screenings.add(screening);
    this.addFilm(screening.filmTitle);
  }
}

module.exports = InMemoryDataStore;
