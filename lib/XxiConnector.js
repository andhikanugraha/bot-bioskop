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
        let registerPromises = [];

        cityOptionElements.each((key, value) => {
          let el = $(value);
          let cityName = el.text().toUpperCase();
          let xxiCityId = parseInt(el.attr('value'));

          registerPromises
            .push(this.registerCity({cityName, xxiCityId}));
        });

        return Promise.all(registerPromises);
      });
  }

  loadCity(cityName) {
    let moviePromises = [];
    let movieUrls = [];
    let cityObj;
    let cityId;

    return this.findCities({cityName})
    .then(cities => {
      if (cities.size === 0) {
        return Promise.reject('cityNotFound');
      }

      cityObj = [...cities][0];
      cityId = cityObj.xxiCityId;

      return this.fetch$(this.listMovieUrl, cityId);
    })
    .then($ => {
      let movieLinkElements = $('[id=menu_ol_arrow] a');
      movieLinkElements.each((k, aElement) => {
        aElement = $(aElement);
        movieUrls.push(aElement.attr('href'));
      });

      return this.loadTheatres(cityId);
    })
    .then(theatreNameById => {
      moviePromises =
        movieUrls.map(movieUrl =>
          this.loadMovie(
            this.baseUrl + movieUrl,
            cityId,
            cityName,
            theatreNameById)
        );
      return Promise.all(moviePromises);
    })
    .then(() => {
      return this.findScreenings({cityName});
    })
    .then(screenings => {
      let theatreNameToIds = new Map;
      for (let screening of screenings) {
        let {theatreName, theatreId} = screening;
        if (!theatreNameToIds.get(theatreName)) {
          theatreNameToIds.set(theatreName, new Set);
        }
        theatreNameToIds.get(theatreName).add(theatreId);
      }

      let theatreObjects = [];
      for (let [theatreName, xxiTheatreIds] of theatreNameToIds) {
        theatreObjects.push({
          theatreName,
          xxiTheatreIds,
          cityName,
          xxiCityId: cityId
        });
      }

      return Promise.all(theatreObjects.map(
        theatreObj => this.registerTheatre(theatreObj)
      ));
    })
    .catch(err => {
      if (err !== 'cityNotFound') {
        return Promise.reject(err);
      }
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

      let theatreNameById = new Map;
      if (allTheatresDiv) {
        let theatresOl = allTheatresDiv.next();

        let theatreLinks = $('li a', theatresOl);
        theatreLinks.each((k, a) => {
          a = $(a);
          let theatreName = a.text();
          let href = a.attr('href');
          let parsedHref = url.parse(href, true);
          let internalId = parsedHref.query.cinema_id;

          theatreNameById.set(internalId, theatreName);
        });
      }

      return theatreNameById;
    });
  }

  loadMovie(movieUrl, cityId, cityName, theatreNameById) {
    return this.fetch$(movieUrl, cityId)
    .then($ => {
      let rawTitle = $('a.flm_ttl').text();
      let sanitizedTitle = '';

      let menuOlSchedules = $('[id=menu_ol_schedule]');

      let screeningPromises = [];

      menuOlSchedules.each((k, ol) => {
        ol = $(ol);
        let theatreUrl = $('a', ol).attr('href');

        let parsedTheatreUrl = url.parse(theatreUrl, true);
        let theatreId = parsedTheatreUrl.query.cinema_id;
        let rawTheatreName = theatreNameById.get(theatreId);

        let {filmTitle, theatreName, variant} =
          this.parseFilmTitle(rawTitle, rawTheatreName);

        sanitizedTitle = filmTitle;

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

          screeningPromises = times.map(time =>
            this.registerScreening({
              cityName,
              theatreName,
              theatreId,
              filmTitle,
              variant,
              date,
              time,
              priceIdr
            }));
        });
      });

      let moviePromise = this.registerFilm({
        filmTitle: sanitizedTitle
      });

      return Promise.all([moviePromise, ...screeningPromises]);
    });
  }
}

module.exports = XxiConnector;
