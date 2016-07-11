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
      let promises = [];
      $('.city').each((i, elm) => {
        let cityName = $(elm).children().first().text().toUpperCase();

        let theatres = new Set;
        let theatreElements =
          $(elm).children().eq(1).children().first().children();

        theatreElements.each((i, elm) => {
          let theatreName = $(elm).first().text().toUpperCase() + ' CGVBLITZ';
          let blitzTheatreId = $(elm).first().children().first().attr('id');
          theatres.add({cityName, theatreName, blitzTheatreId});
        });

        for (let theatre of theatres) {
          promises.push(this.registerTheatre(theatre));
        }

        promises.push(this.registerCity({cityName}));
      });

      return Promise.all(promises);
    });
  }

  loadCity(cityName) {
    this.findTheatres({cityName}).then(cinemas => {
      let theatrePromises = [];
      for (let {theatreName, blitzTheatreId} of cinemas) {
        theatrePromises.push(this.loadTheatre({
          theatreName,
          theatreId: blitzTheatreId,
          cityName
        }));
      }

      return Promise.all(theatrePromises);
    });
  }

  loadTheatre({theatreName, theatreId, cityName}) {
    return this.fetch$(this.baseUrl + '/' + theatreId)
    .then($ => {
      let screeningPromises = [];
      $('.schedule-title').each((i, elm) => {
        let filmTitle = $(elm).children().first().text();

        let variantElements = $(elm).parent().find('.schedule-type');
        variantElements.each((i, elm) => {
          let variant = $(elm).text().trim();

          let timeElements = $(elm).next().find('.showtime-lists').children();
          timeElements.each((i, elm) => {
            screeningPromises.push(this.registerScreening({
              cityName,
              theatreName,
              theatreId,
              filmTitle,
              variant,
              date: this.today(),
              time: $(elm).text(),
              priceIdr:
                parseInt($(elm).first().children().first().attr('price'))
            }));
          });
        });
      });
      return Promises.all(screeningPromises);
    });
  }
}

module.exports = BlitzConnector;
