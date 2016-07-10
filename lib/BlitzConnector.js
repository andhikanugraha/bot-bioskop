// Derived from https://github.com/sonnylazuardi/blitz-cli

const cheerio = require('cheerio');
const fetch = require('node-fetch');
const moment = require('moment'); require('moment-timezone');
const ProviderConnector = require('./ProviderConnector');

class BlitzConnector extends ProviderConnector {
  constructor(dataStore) {
    super(dataStore);
    this.providerId = 'cgvblitz';

    this.baseUrl = 'https://www.cgvblitz.com/en/schedule/cinema';
    this.seatUrl = 'https://www.cgvblitz.com/en/schedule/seat';

    this.model = [];
    this.cities = new Map;
  }

  today() {
    return moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
  }

  fetch$(targetUrl) {
    return fetch(targetUrl)
    .then(response => {
      return response.text();
    })
    .then(responseText => cheerio.load(responseText));
  }

  init() {
    return this.fetch$(this.baseUrl)
    .then($ => {
      $('.city').each((i, elm) => {
        let cityName = $(elm).children().first().text().toUpperCase();

        let theatres = new Map;
        let theatreElements =
          $(elm).children().eq(1).children().first().children();
        theatreElements.each((i, elm) => {
          let theatreName = $(elm).first().text().toUpperCase() + ' CGVBLITZ';
          let theatreId = $(elm).first().children().first().attr('id');
          theatres.set(theatreName, theatreId);
        });

        this.cities.set(cityName, theatres);

        this.registerCity(cityName);
      });
    });
  }

  loadCity(cityName) {
    let cinemas = this.cities.get(cityName);

    let cinemaPromises = [];
    for (let [theatreName, theatreId] of cinemas) {
      cinemaPromises.push(this.loadCinema({theatreName, theatreId, cityName}));
    }

    return Promise.all(cinemaPromises);
  }

  loadCinema({theatreName, theatreId, cityName}) {
    return this.fetch$(this.baseUrl + '/' + theatreId)
    .then($ => {
      $('.schedule-title').each((i, elm) => {
        let filmTitle = $(elm).children().first().text();

        let variantElements = $(elm).parent().find('.schedule-type');
        variantElements.each((i, elm) => {
          let variant = $(elm).text().trim();

          let timeElements = $(elm).next().find('.showtime-lists').children();
          timeElements.each((i, elm) => {
            this.registerScreening({
              city: cityName,
              theatreName,
              theatreId,
              filmTitle,
              variant,
              date: this.today(),
              time: $(elm).text(),
              price: parseInt($(elm).first().children().first().attr('price'))
            });
          });
        });
      });
    });
  }
}

module.exports = BlitzConnector;
