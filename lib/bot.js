const builder = require('botbuilder');
const numeral = require('numeral');
const CinemaCore = require('./CinemaCore');

let bot = new builder.UniversalBot;

let intents = new builder.IntentDialog();

intents.onBegin((session, args, next) => {
  session.send('Hi! My name is bot-bioskop.');
  next();
});

intents.matches(/^help/i, '/help');
intents.matches(/^change\s+city/i, '/changeCity');
intents.matches(/^(movie|film)s?/i, '/films');
intents.matches(/^(cinema|theatre)s?/i, '/theatres');
intents.matches(/^\/refresh$/, '/forceRefresh');
intents.matches(/^.*$/i, '/query');
intents.onDefault('/help');

bot.dialog('/', intents);

const middleware = {
  requireCity(prompt) {
    return (session, result, skip) => {
      session.userData.prevResponse = result.prevResponse;
      if (!session.userData.cityName) {
        session.beginDialog('/changeCity', {prompt});
      } else {
        let {cityName} = session.userData;
        CinemaCore.loadCity(cityName).then(() => {
          let prevResponse = session.userData.prevResponse;
          if (prevResponse) {
            result.response = prevResponse;
          }
          skip(result);
        });
      }
    };
  }
};

const templates = {
  list(session, prompt, list, label = x => x) {
    let answerString = prompt;
    for (let item of list) {
      let value = label(item);
      answerString += `\n • ${value}`;
    }
    session.send(answerString);
  },

  schedule(session, prompt, schedule) {
    if (!schedule && prompt) {
      schedule = prompt;
      prompt = undefined;
    }

    let answerString = prompt ? prompt + '\n' : '';
    for (let [theatreName, variants] of schedule) {
      answerString += `*${theatreName}*`;
      for (let [variant, {times, price}] of variants) {
        let prettyPrice = numeral(price).format('0,0');
        let timesString = times.join(', ');
        answerString += `\n${variant} (Rp${prettyPrice}): ${timesString}`;
      }
      answerString += '\n\n';
    }

    session.send(answerString);
  }
};

bot.dialog('/help', [
  (session, result, skip) => {
    session.send(
      'I can help you check movie times across XXI and CGV Blitz. ' +
      "Tell me which movie or cinema you'd like to find out the " +
      'schedule for, or type "movies" or "cinemas" to see ' +
      "what's available.");
    skip();
  },
  middleware.requireCity('By the way, which city do you live in?')
]);

bot.dialog('/changeCity', [
  (session, result, skip) => {
    if (result && result.response) {
      skip(result);
    } else {
      let promptText = 'Which city would you like to switch to?';
      if (result && result.prompt) {
        promptText = result.prompt;
      }
      builder.Prompts.text(session, promptText);
    }
  },
  (session, result, skip) => {
    // Validate cityName
    let {response} = result;

    CinemaCore.resolveKeyword({keyword: response, type: 'city'})
    .then(keyword => {
      if (!keyword) {
        session.send(
          `I'm sorry, I'm afraid there are no cinemas listed in ${response}.`);

        return CinemaCore.findCities().then(cities => {
          templates.list(session, 'The available cities are:',
                   cities, c => c.cityName);

          session.replaceDialog('/changeCity',
            {prompt: 'Which city would you like to switch to?'});
        });
      } else {
        let cityName = keyword.keyword;
        session.userData.cityName = cityName;
        return CinemaCore.isCityLoaded(cityName)
        .then(isLoaded => {
          if (!isLoaded) {
            session.send(
              `Got it. I need to load data for ${cityName}. Hang on...`);
            return CinemaCore.loadCity(cityName);
          } else {
            return Promise.resolve();
          }
        })
        .then(() => skip());
      }
    });
  },
  (session) => {
    session.send(
      `All set. You've switched your city to ${session.userData.cityName}. ` +
      'You can type "change city" later on to switch to another city.');
    if (session.userData.prevResponse) {
      session.endDialog();
    } else {
      session.replaceDialog('/help');
    }
  }
]);


bot.dialog('/theatres', [
  middleware.requireCity(),
  (session) => {
    let cityName = session.userData.cityName;
    CinemaCore.findTheatres({cityName})
    .then(theatres => {
      templates.list(session, 'The following cinemas are available:',
               theatres, f => f.theatreName);

      let promptText = 'Which would you like to check the schedule for?';
      builder.Prompts.text(session, promptText);
    });
  },
  (session, result) => {
    let response = result.response.trim().toUpperCase();
    session.replaceDialog('/theatres/{id}', {response});
  }
]);

bot.dialog('/theatres/{id}', [
  middleware.requireCity(),
  (session, result, skip) => {
    if (result && result.response) {
      skip(result);
    } else {
      builder.Prompts.text(session,
        'Which cinema would you like to check the schedule for?');
    }
  },
  (session, result, skip) => {
    CinemaCore.resolveKeyword({
      keyword: result.response,
      type: 'theatre',
      allowAmbiguous: true
    }).then(keywords => {
      if (keywords.size === 0) {
        session.send('Sorry, no matching cinemas were found.');
        session.replaceDialog('/help');
      } else if (keywords.size === 1) {
        skip({response: [...keywords][0].keyword});
      } else {
        templates.list(session, 'Multiple cinemas were found:',
                 keywords, k => k.keyword);
        session.replaceDialog('/theatres/{id}');
      }
    });
  },
  (session, result) => {
    let theatreName = result.response;
    CinemaCore.getScheduleTree({
      cityName: session.userData.cityName,
      theatreName
    }).then(schedule => {
      session.send(`Schedule for *${theatreName}*:`);

      templates.schedule(session, schedule);

      session.dialogData.theatreName = theatreName;
      if (schedule.size > 5) {
        session.replaceDialog('/theatres/{id}/films', {theatreName});
      } else {
        session.replaceDialog('/help');
      }
    });
  }
]);

bot.dialog('/theatres/{id}/films', [
  (session, result) => {
    let {theatreName, preprompt} = result;

    if (!theatreName) {
      session.endDialog();
    }

    session.dialogData.theatreName = result.theatreName;
    let promptText =
      `Type the name of a movie to see the *${theatreName}* schedule ` +
      'for that movie only, or type anything else to exit.';

    if (preprompt) {
      promptText = preprompt.trim() + ' ' + promptText;
    }

    builder.Prompts.text(session, promptText);
  },
  (session, result) => {
    let {response} = result;
    let {theatreName} = session.dialogData;

    CinemaCore.getScheduleTree({
      cityName: session.userData.cityName,
      theatreName,
      filmTitle: CinemaCore.stringToSearchPattern(response)
    }).then(schedule => {
      if (schedule.size > 0) {
        // User entered a theatre that shows the theatre
        templates.schedule(session, schedule);
        session.replaceDialog('/theatres/{id}/films', {theatreName});
      } else {
        // No matching theatres
        session.send(`Alright, that's it for the schedule for ${theatreName}.`);
        session.replaceDialog('/help');
      }
    });
  }
]);

bot.dialog('/films', [
  middleware.requireCity(),
  (session) => {
    let cityName = session.userData.cityName;
    CinemaCore.getAvailableFilms({cityName})
    .then(films => {
      templates.list(session, 'The following films are available:',
               films, f => f.filmTitle);

      let promptText = 'Which would you like to check the schedule for?';
      builder.Prompts.text(session, promptText);
    });
  },
  (session, result) => {
    let response = result.response.trim().toUpperCase();
    session.replaceDialog('/films/{id}', {response});
  }
]);

bot.dialog('/films/{id}', [
  middleware.requireCity(),
  (session, result, skip) => {
    if (result && result.response) {
      skip(result);
    } else {
      builder.Prompts.text(session,
        'Which movie would you like to check the schedule for?');
    }
  },
  (session, result, skip) => {
    CinemaCore.resolveKeyword({
      keyword: result.response,
      type: 'film',
      allowAmbiguous: true
    }).then(keywords => {
      if (keywords.size === 0) {
        session.send('Sorry, no matching films were found.');
        session.replaceDialog('/help');
      } else if (keywords.size === 1) {
        skip({response: [...keywords][0].keyword});
      } else {
        templates.list(session, 'Multiple films were found:',
                 keywords, k => k.keyword);
        session.replaceDialog('/films/{id}');
      }
    });
  },
  (session, result) => {
    let filmTitle = result.response;
    CinemaCore.getScheduleTree({
      cityName: session.userData.cityName,
      filmTitle
    }).then(schedule => {
      session.send(`Schedule for *${filmTitle}*:`);

      templates.schedule(session, schedule);

      session.dialogData.filmTitle = filmTitle;
      if (schedule.size > 5) {
        session.replaceDialog('/films/{id}/theatres',
          {filmTitle, preprompt: 'A lot of cinemas are showing this movie.'});
      } else {
        session.replaceDialog('/help');
      }
    });
  }
]);

bot.dialog('/films/{id}/theatres', [
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

    CinemaCore.getScheduleTree({
      cityName: session.userData.cityName,
      filmTitle,
      theatreName: CinemaCore.stringToSearchPattern(response)
    }).then(schedule => {
      if (schedule.size > 0) {
        // User entered a theatre that shows the film
        templates.schedule(session, schedule);
        session.replaceDialog('/films/{id}/theatres', {filmTitle});
      } else {
        // No matching theatres
        session.send(`Alright, that's it for the schedule for ${filmTitle}.`);
        session.replaceDialog('/help');
      }
    });
  }
]);

bot.dialog('/query', [
  (session, args) => {
    let command = args.matched.trim();

    CinemaCore.resolveKeyword({keyword: command})
    .then(keywordObj => {
      if (keywordObj) {
        let {keyword, type} = keywordObj;
        let dialogMap = {
          'city': '/changeCity',
          'film': '/films/{id}',
          'theatre': '/theatres/{id}'
        };
        session.replaceDialog(dialogMap[type], {response: keyword});
      } else {
        session.replaceDialog('/help');
      }
    });
  }
]);

bot.dialog('/forceRefresh', [
  (session, result, skip) => {
    let usePassword = !!process.env.MICROSOFT_APP_PASSWORD;
    if (usePassword) {
      builder.Prompts.text(session, 'This is a production environment. ' +
        'Please enter the Microsoft App Password to proceed.');
    } else {
      session.send('This is a development environment.');
      skip();
    }
  },
  (session, result, skip) => {
    let password = process.env.MICROSOFT_APP_PASSWORD;
    let {response} = result;
    if (password && response.password !== password)  {
      session.send('Access denied.');
      session.replaceDialog('/help');
    } else {
      skip();
    }
  },
  (session) => {
    session.send('Refreshing data...');
    CinemaCore.refresh().then((previouslyLoadedCities) => {
      templates.list(session,
        'The following cities were previously loaded and have been reloaded:',
        previouslyLoadedCities);
      session.send('Data successfully refreshed.');
      session.endDialog();
    });
  }
]);

module.exports = bot;
