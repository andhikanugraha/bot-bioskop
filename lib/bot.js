const builder = require('botbuilder');
const moment = require('moment'); require('moment-timezone');
const numeral = require('numeral');
const CinemaCore = require('./CinemaCore');

function now(session) {
  if (!session.userData.timezone) {
    session.userData.timezone = 'Asia/Jakarta';
  }
  return moment().tz(session.userData.timezone);
}

function clean(str) {
  return str
    .trim()
    .replace(/s+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase();
}

function testMatch(haystack, needle) {
  haystack = clean(haystack);
  needle = clean(needle);

  let needleRegex = new RegExp(needle.replace(/ /g, '.+'));

  return !!needleRegex.exec(haystack);
}

function searchSet(haystack, needle) {
  if (typeof needle !== 'string') {
    throw new Error('searchSet: invalid input');
  }

  let potentialMatches = new Set;
  for (let item of haystack) {
    if (clean(item) === clean(needle)) {
      return item;
    } else if (testMatch(item, needle)) {
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

function filterMapByKey(haystack, needle) {
  if (typeof needle !== 'string') {
    throw new Error('searchSet: invalid input');
  }

  let filteredMap = new Map;
  for (let item of haystack.keys()) {
    if (testMatch(item, needle)) {
      filteredMap.set(item, haystack.get(item));
    }
  }

  if (filteredMap.size > 0) {
    return filteredMap;
  } else {
    return false;
  }
}

let bot = new builder.UniversalBot;

let intents = new builder.IntentDialog();

bot.dialog('/command', intents);

intents.onBegin((session, args, next) => {
  session.send('Hi! I can help you check movie times.');
  next();
});

intents.matches(/^help/i, '/help');
intents.matches(/^change\s+city/i, '/changeCity');
intents.matches(/^(movies|films)/i, session => session.beginDialog('/films'));
intents.matches(/^(cinemas|theatres)/i, '/theatres');
intents.matches(/^.*$/i, '/query');

intents.onDefault((session) => {
  session.beginDialog('/help');
});

bot.dialog('/', intents);

function sendHelpText(session) {
  session.send(
    "Tell me which movie or cinema you'd like to find out the schedule for, " +
    'or type "movies" to see what movies are available.');
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
  requireCity('By the way, which city do you live in?')
]);

bot.dialog('/changeCity', [
  (session, result, skip) => {
    if (result.cityName) {
      skip({response: result.cityName});
    }

    let promptText = 'Which city would you like to switch to?';
    if (result.prompt) {
      promptText = result.prompt;
    }

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
        citiesString += `\n • ${city}`;
      }

      session.send(citiesString);
      session.replaceDialog('/changeCity',
        {prompt: 'Which city would you like to switch to?'});
    } else {
      session.userData.cityName = cityName;
      if (!CinemaCore.loadedCities.has(cityName)) {
        session.send(`Got it. I need to load data for ${cityName}. Hang on...`);
        CinemaCore.loadCity(cityName).then(() => {
          skip();
        });
      } else {
        skip();
      }
    }
  },
  (session) => {
    session.send(
      `All set. You've switched your city to ${session.userData.cityName}. ` +
      'You can type "change city" later on to switch to another city.');
    session.replaceDialog('/help');
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
      answerString += '\n • ' + film;
    }
    session.send(answerString);

    let promptText = 'Which would you like to check the schedule for?';
    builder.Prompts.text(session, promptText);
  },
  (session, result) => {
    let response = result.response.trim();
    let filmTitle = response.toUpperCase();
    session.replaceDialog('/filmDetails', {filmTitle});
  }
]);

function generateScheduleMessage(schedule) {
  let answerString = '';
  for (let [theatreName, variants] of schedule) {
    answerString += `*${theatreName}*`;
    for (let [variant, {times, price}] of variants) {
      let prettyPrice = numeral(price).format('0,0');
      let timesString = times.join(', ');
      answerString += `\n${variant} (Rp${prettyPrice}): ${timesString}`;
    }
    answerString += '\n\n';
  }
  return answerString;
}

function getTodaySchedule({session, filmTitle}) {
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

  return schedule;
}

bot.dialog('/filmDetails', [
  (session, result, skip) => {
    // Validate the title
    let {filmTitle} = result;
    filmTitle = searchSet(CinemaCore.dataStore.films, filmTitle);
    if (!filmTitle) {
      session.send('Sorry, no matching films were found.');
      session.endDialog();
    } else {
      session.send(`Schedule for *${filmTitle}*:`);

      let schedule = getTodaySchedule({session, filmTitle});
      let answerString = generateScheduleMessage(schedule);

      session.send(answerString);

      // TODO: Allow to narrow down by theatre
      session.dialogData.filmTitle = filmTitle;
      if (schedule.size > 5) {
        session.replaceDialog('/filmByTheatre',
          {filmTitle, preprompt: 'A lot of cinemas are showing this movie.'});
      } else {
        session.endDialog();
      }
    }
  }
]);

bot.dialog('/filmByTheatre', [
  (session, result) => {
    let {filmTitle, preprompt} = result;

    if (!filmTitle) {
      session.endDialog();
    }

    session.dialogData.filmTitle = result.filmTitle;
    let promptText =
      `Type the name of a cinema to see the *${filmTitle}* schedule ` +
      'for that cinema only, or type anything else to exit.';

    if (preprompt) {
      promptText = preprompt.trim() + ' ' + promptText;
    }

    builder.Prompts.text(session, promptText);
  },
  (session, result) => {
    let {response} = result;
    let {filmTitle} = session.dialogData;

    let schedule = getTodaySchedule({session, filmTitle});

    let filteredSchedule = filterMapByKey(schedule, response);
    if (filteredSchedule) {
      // User entered a theatre that shows the film
      let answerString = generateScheduleMessage(filteredSchedule);
      session.send(answerString);
      session.replaceDialog('/filmByTheatre', {filmTitle});
    } else {
      session.send(`Alright, that's it for the schedule for ${filmTitle}.`);
      session.endDialog();
    }
  }
]);

bot.dialog('/query', [
  (session, args, next) => {
    let command = args.matched.trim().toUpperCase();

    // session.send('Command: ' + command);

    session.dialogData.command = command;
    next();
  },
  // (session, args, next) => {
  //   let command = session.dialogData.command;
  //   // Search for cities
  //   // session.send('Looking for cities...');

  //   let foundCityName = searchSet(CinemaCore.dataStore.cities, command);
  //   if (foundCityName) {
  //     // session.send('Found city.');
  //     session.beginDialog('/changeCity', {cityName: foundCityName});
  //   } else {
  //     // session.send('Not a city.');
  //     next();
  //   }
  // },
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
