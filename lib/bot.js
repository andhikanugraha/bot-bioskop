const builder = require('botbuilder');
const moment = require('moment'); require('moment-timezone');
const lodash = require('lodash');
const CinemaCore = require('./CinemaCore');

function now(session) {
  if (!session.userData.timezone) {
    session.userData.timezone = 'Asia/Jakarta';
  }
  return moment().tz(session.userData.timezone);
}

function searchSet(haystack, needle) {
  if (typeof needle !== 'string') {
    throw new Error('searchSet: invalid input');
  }

  needle = needle.trim();
  needle = needle.replace(/\s+/g, ' ');
  needle = needle.toUpperCase();

  let potentialMatches = new Set;
  for (let item of haystack) {
    if (needle === item) {
      return item;
    } else if (lodash.startsWith(item, needle)) {
      potentialMatches.add(item);
    } else if (lodash.endsWith(item, needle)) {
      potentialMatches.add(item);
    }
  }

  if (potentialMatches.size === 1) {
    for (let item of potentialMatches) {
      return item;
    }
  }

  return false;
}

let bot = new builder.UniversalBot;

let intents = new builder.IntentDialog();

bot.dialog('/command', intents);

intents.onBegin((session, args, next) => {
  session.send('Hi! My name is bot-bioskop.');
  next();
});

intents.matches(/^help/i, '/help');
intents.matches(/^change\s+city/i, '/changeCity');
intents.matches(/^(movies|films)/i, '/films');
intents.matches(/^(cinemas|theatres)/i, '/theatres');
intents.matches(/^.*$/i, '/query');

intents.onDefault((session) => {
  session.beginDialog('/help');
});

bot.dialog('/', intents);

function sendHelpText(session) {
  session.send(`Type the name of a movie to see where it's being showed,
    or type the name of a cinema to see what movies they're showing.
    Alternatively, type "movies" or "cinemas" to see what's available.`);
}

function requireCity(prompt) {
  return (session, result, skip) => {
    if (!session.userData.cityName) {
      session.beginDialog('/changeCity', {prompt});
    } else {
      skip({result});
    }
  };
}

bot.dialog('/help', [
  (session, result, skip) => {
    sendHelpText(session);
    skip();
  },
  requireCity('By the way, where do you live?')
]);

bot.dialog('/changeCity', [
  (session, result) => {
    if (result.cityName) {
      skip({response: result.cityName});
    }

    let promptText = 'Hi! Where do you live?';
    if (result.prompt) {
      promptText = result.prompt;
    }
    console.log(promptText);
    builder.Prompts.text(session, promptText);
  },
  (session, result, skip) => {
    // Validate cityName
    let {response} = result;

    let cityName = searchSet(CinemaCore.dataStore.cities, response);
    if (!cityName) {
      session.send(
        `I'm sorry, I'm afraid there are no cinemas listed in ${response}.`);

      let citiesString = 'The available cities are:';
      for (let city of CinemaCore.dataStore.cities) {
        citiesString += `\n * ${city}`;
      }

      session.send(citiesString);
      session.endDialog();
      session.beginDialog('/changeCity', {prompt:'Where do you live?'});
    } else {
      session.userData.cityName = cityName;
      if (!CinemaCore.loadedCities.has(cityName)) {
        session.send(`Got it. Loading data for ${cityName}. Please wait...`);
        CinemaCore.loadCity(cityName).then(() => {
          skip(result);
        });
      } else {
        skip(result);
      }
    }
  },
  (session) => {
    session.send(`All set. Switched city to ${session.userData.cityName}.`);
    session.endDialog();
    session.beginDialog('/help');
  }
]);

bot.dialog('/theatres', [
  (session) => {
    session.send('This feature has not been implemented. Stay tuned!');
    session.endDialog();
  }
]);

bot.dialog('/films', [
  (session) => {
    let films = CinemaCore.dataStore.films;
    let answerString = 'The following films are available:';
    for (let film of films) {
      answerString += '\n * ' + film;
    }
    session.send(answerString);

    let promptText = 'Which would you like to check the schedule for?';
    builder.Prompts.text(session, promptText);
  },
  (session, result) => {
    let response = result.response.trim();
    let filmTitle = response.toUpperCase();
    session.beginDialog('/filmDetails', {filmTitle});
  }
]);

bot.dialog('/filmDetails', [
  (session, result, skip) => {
    // Validate the title
    let {filmTitle} = result;
    filmTitle = searchSet(CinemaCore.dataStore.films, filmTitle);
    if (!filmTitle) {
      session.send('Sorry, no matching films were found.');
      session.endDialog();
    } else {
      skip({filmTitle});
    }
  },
  (session, result) => {
    let {filmTitle} = result;
    session.send(`Schedule for **${filmTitle}**:`);

    let datetime = now(session);
    let todayDate = datetime.format('YYYY-MM-DD');
    let nowTime = datetime.format('hh:mm');

    let schedule =
      CinemaCore.getScheduleByFilmAndCity(
        session.userData.cityName,
        filmTitle,
        todayDate,
        nowTime
      );

    let answerString = '';
    for (let [theatreName, variants] of schedule) {
      answerString += `**${theatreName}**`;
      for (let [variant, times] of variants) {
        let timesString = times.join(', ');
        answerString += `\n * _${variant}_: ${timesString}`;
      }
      answerString += '\n\n';
    }

    setTimeout(() => session.send(answerString), 500);

    // TODO: Allow to narrow down by theatre

    session.endDialog();
  }
]);

bot.dialog('/query', [
  (session, args, next) => {
    let command = args.matched.trim().toUpperCase();

    // session.send('Command: ' + command);

    session.dialogData.command = command;
    next();
  },
  (session, args, next) => {
    let command = session.dialogData.command;
    // Search for cities
    // session.send('Looking for cities...');

    let foundCityName = searchSet(CinemaCore.dataStore.cities, command);
    if (foundCityName) {
      // session.send('Found city.');
      session.beginDialog('/changeCity', {cityName: foundCityName});
    } else {
      // session.send('Not a city.');
      next();
    }
  },
  (session, args, next) => {
    let command = session.dialogData.command;
    // Search for theatres
    // session.send('Looking for theatres...');

    let theatreName = searchSet(CinemaCore.dataStore.theatres, command);
    if (theatreName) {
      session.send('Theatre view: this feature has not been implemented.');
      next();
    } else {
      // session.send('Not a theatre.');
      next();
    }
  },
  (session, args, next) => {
    let command = session.dialogData.command;
    // Search for films
    // session.send('Looking for films...');

    let filmTitle = searchSet(CinemaCore.dataStore.films, command);
    if (filmTitle) {
      session.beginDialog('/filmDetails', {filmTitle});
    } else {
      // session.send('Not a film.');
      next();
    }
  },
  (session) => {
    session.endDialog();
    session.beginDialog('/help');
  }
]);

module.exports = bot;
