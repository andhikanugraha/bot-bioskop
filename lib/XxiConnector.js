const cheerio = require('cheerio');
const fetch = require('node-fetch');
const ProviderConnector = require('./ProviderConnector');
const url = require('url');

class XxiConnector extends ProviderConnector {
  constructor(dataStore) {
    super(dataStore);
    this.providerId = 'xxi';

    this.baseUrl = 'http://m.21cineplex.com/';
    this.listMovieUrl = 'http://m.21cineplex.com/gui.list_movie';
    this.listTheatreUrl = 'http://m.21cineplex.com/gui.list_theater';

    this.cityIds = new Map;
    this.theatreNameById = new Map;
  }

  parseFilmTitle(rawTitle, theatreName) {
    rawTitle = rawTitle.trim();
    theatreName = theatreName.trim();

    let filmTitle = rawTitle;
    let variant = 'Regular';

    let matchTheatreType = theatreName.match(/^(.+)\s(PREMIERE|IMAX)$/i);
    if (matchTheatreType) {
      [, theatreName, variant] = matchTheatreType;
      theatreName += ' XXI';
    }

    if (!theatreName.match(/XXI|21/i)) {
      theatreName += ' 21';
    }

    // Parse filmTitle
    let matchImaxFilm = rawTitle.match(/^(.+)\s\(((?:IMAX )?[2-3]D)\)$/i);
    if (matchImaxFilm) {
      [, filmTitle, variant] = matchImaxFilm;
    }

    return {
      filmTitle,
      theatreName,
      variant
    };
  }

  fetch$(targetUrl, cityId=10) {
    let parsedUrl = url.parse(targetUrl, true);
    if (!parsedUrl.query) {
      parsedUrl.query = {};
    }
    parsedUrl.query['city_id'] = cityId;
    targetUrl = url.format(parsedUrl);

    return fetch(targetUrl, {
      headers: {
        Cookie: `city_id=${cityId}`
      }
    })
    .then(response => {
      return response.text();
    })
    .then(responseText => cheerio.load(responseText));
  }

  init() {
    return this.fetch$(this.baseUrl)
    .then($ => {
      let cityOptionElements = $('#city_id option');

      cityOptionElements.each((key, value) => {
        let el = $(value);
        let cityName = el.text().toUpperCase();
        let internalId = parseInt(el.attr('value'));
        this.registerCity(cityName);
        this.cityIds.set(cityName, internalId);
      });
    });
  }

  loadCity(cityName) {
    let cityId = this.cityIds.get(cityName);
    if (!cityId) {
      return Promise.resolve(false);
    }

    let moviePromises = [];
    let movieUrls = [];

    return this.fetch$(this.listMovieUrl, cityId)
    .then($ => {
      let movieLinkElements = $('[id=menu_ol_arrow] a');
      movieLinkElements.each((k, aElement) => {
        aElement = $(aElement);
        movieUrls.push(aElement.attr('href'));
      });

      return this.loadTheatres(cityId);
    })
    .then(() => {
      moviePromises =
        movieUrls.map(movieUrl =>
          this.loadMovie(this.baseUrl + movieUrl, cityId, cityName)
        );
      return Promise.all(moviePromises);
    });
  }

  loadTheatres(cityId) {
    return this.fetch$(this.listTheatreUrl, cityId)
    .then($ => {
      let boxTitles = $('div[id=box_title]');
      let allTheatresDiv;
      boxTitles.each((k, div) => {
        div = $(div);
        if (div.text().trim() === 'ALL THEATERS') {
          allTheatresDiv = div;
        }
      });

      if (allTheatresDiv) {
        let theatresOl = allTheatresDiv.next();

        let theatreLinks = $('li a', theatresOl);
        let self = this;
        theatreLinks.each((k, a) => {
          a = $(a);
          let theatreName = a.text();
          let href = a.attr('href');
          let parsedHref = url.parse(href, true);
          let internalId = parsedHref.query.cinema_id;

          self.theatreNameById.set(internalId, theatreName);
        });
      }
    });
  }

  loadMovie(movieUrl, cityId, cityName) {
    return this.fetch$(movieUrl, cityId)
    .then($ => {
      let rawTitle = $('a.flm_ttl').text();

      let menuOlSchedules = $('[id=menu_ol_schedule]');

      menuOlSchedules.each((k, ol) => {
        ol = $(ol);
        let theatreUrl = $('a', ol).attr('href');

        let parsedTheatreUrl = url.parse(theatreUrl, true);
        let theatreId = parsedTheatreUrl.query.cinema_id;
        let rawTheatreName = this.theatreNameById.get(theatreId);

        let {filmTitle, theatreName, variant} =
          this.parseFilmTitle(rawTitle, rawTheatreName);

        let div = ol.next();

        let datePs = $('p.p_date', div);
        datePs.each((k, p) => {
          p = $(p);

          // Get the date
          let sourceDateString = p.text();
          let [, dd, mm, yyyy] =
            sourceDateString.match(/([0-9]{2})\-([0-9]{2})\-([0-9]{4})/);
          let date = [yyyy, mm, dd].join('-');

          // Get the times for this date
          let timesP = p.next();
          let timesString = timesP.text();
          let timesStringSplit = timesString.split(/\s+/g);
          let times = timesStringSplit.map(fragment => {
            if (!fragment.match(/^\[[0-9]{2}\:[0-9]{2}\]$/)) {
              return null;
            }

            return fragment.substr(1,5);
          }).filter(fragment => !!fragment);

          let priceP = timesP.next();
          let priceString = priceP.text();
          let [matchPrice] = priceString.match(/(?:,?[0-9]{0,3})+$/);
          let priceIdr = parseInt(matchPrice.replace(/,/g, ''));

          times.forEach(time => {
            this.registerScreening({
              city: cityName,
              theatreName,
              theatreId,
              filmTitle,
              variant,
              date,
              time,
              priceIdr
            });
          });
        });
      });
    });
  }
}

module.exports = XxiConnector;
