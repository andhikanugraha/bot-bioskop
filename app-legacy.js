const cheerio = require('cheerio');
const fetch = require('node-fetch');
const url = require('url');
const querystring = require('querystring');

class CinemaChain {
  constructor() {
  }

  getCities() {}
}

class City {
  constructor(name, internalId) {
    this.internalId = internalId || null;
    this.name = name || '';
  }

  getMovies() {}
  getTheatres() {}
}

class Theatre {
  constructor(name, internalId, cityObj) {
    this.name = name || '';
    this.internalId = internalId || null;
    this.cityObj = cityObj || null;
  }

  getSchedule() {}
}

class Movie {
  constructor() {
    this.genre = '';
    this.durationInMinutes = 0;
    this.theatreTimes = new Map();
  }

  getSchedule() {}
}

class Show {
  constructor() {
    this.time = '';
    this.studioId = 0;
  }
}

// XXI

class XxiTheatre extends Theatre {
  constructor(...args) {
    super(...args);
    this.scheduleUrl = 'http://m.21cineplex.com/gui.schedule?find_by=2&cinema_id=';
  }

  getSchedule() {
    return fetch(this.scheduleUrl + this.internalId, {
      headers: {
        Cookie: 'city_id=' + this.cityObj.internalId
      }
    })
    .then(response => response.text())
    .then(responseText => {
      let $ = cheerio.load(responseText);

      let menuOlSchedules = $('[id=menu_ol_schedule]');

      let schedules = new Map;
      menuOlSchedules.each((k, ol) => {
        ol = $(ol);
        let movieTitle = ol.text().trim();
        let movieId;
        let div = ol.next();

        let timesByDate = new Map;

        let datePs = $('p.p_date', div);
        datePs.each((k, p) => {
          p = $(p);

          // Get the date
          let sourceDateString = p.text();
          let [x, dd, mm, yyyy] = sourceDateString.match(/([0-9]{2})\-([0-9]{2})\-([0-9]{4})/);
          let isoDateString = [yyyy, mm, dd].join('-');

          // Get the times for this date
          let times = [];
          let timeLinks = $('a', p.next());
          timeLinks.each((k, a) => {
            a = $(a);
            if (!movieId) {
              let href = a.attr('href');
              let parsedHref = url.parse(href, true);
              movieId = parsedHref.query.movie_id;
            }
            times.push(a.text());
          });

          timesByDate.set(isoDateString, times);
        });

        timesByDate.movieTitle = movieTitle;
        timesByDate.movieId = movieId;

        console.dir(timesByDate);

        schedules.set(movieTitle, timesByDate);
      });
    });
  }
}

class XxiCity extends City {
  constructor(...args) {
    super(...args);
    this.theatresUrl = 'http://m.21cineplex.com/gui.list_theater?city_id=';
  }

  getTheatres() {
    return fetch(this.theatresUrl + this.internalId, {
      headers: {
        Cookie: 'city_id=' + this.internalId
      }
    })
    .then(response => response.text())
    .then(responseText => {
      let $ = cheerio.load(responseText);
      let boxTitles = $('div[id=box_title]');
      let allTheatresDiv;
      boxTitles.each((k, div) => {
        div = $(div);
        if (div.text().trim() === 'ALL THEATERS') {
          allTheatresDiv = div;
        }
      });

      let theatreSet = new Set();
      if (allTheatresDiv) {
        let theatresOl = allTheatresDiv.next();

        let theatreLinks = $('li a', theatresOl);
        theatreLinks.each((k, a) => {
          a = $(a);
          let theatreName = a.text();
          let href = a.attr('href');
          let parsedHref = url.parse(href, true);
          let internalId = parsedHref.query.cinema_id;

          let theatreObj = new XxiTheatre(theatreName, internalId, this);
          theatreSet.add(theatreObj);
        });
      }

      return theatreSet;
    });
  }
}

class XxiClient extends CinemaChain {
  constructor() {
    super();
    this.baseUrl = 'http://m.21cineplex.com/';
  }

  getCities() {
    return fetch(this.baseUrl, {
      headers: {
        Cookie: 'city_id=10'
      }
    })
    .then(response => response.text())
    .then(responseText => {
      let $ = cheerio.load(responseText);
      let cityOptionElements = $('#city_id option');

      let mapOfCities = new Map();

      cityOptionElements.each((key, value) => {
        let el = $(value);
        let cityName = el.text();
        let internalId = parseInt(el.attr('value'));
        let cityObject = new XxiCity(cityName, internalId);
        mapOfCities.set(cityName, cityObject);
      });

      return mapOfCities;
    });
  }
}

let client = new XxiClient();
client.getCities().then(cities => {
  let city = cities.get('JAKARTA');
  let promises = [];
  console.log(city);
  city.getTheatres().then(theatres => {
    console.log(theatres);
    for (let theatre of theatres) {
      promises.push(theatre.getSchedule());
    }
  });

  return Promise.all(promises);
});
