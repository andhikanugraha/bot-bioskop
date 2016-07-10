const restify = require('restify');
const builder = require('botbuilder');

const CinemaCore = require('./lib/CinemaCore');
const bot = require('./lib/bot');

/*
The idea:
- gather all the data, UI later
- for each provider (xxi, blitz, cinemaxx),
  implement a Connector interface, that will
  - init
  - loadCity
*/

CinemaCore.init()
.then(function initBot() {
  let serverPort = process.env.port || process.env.PORT || 3978;

  // Setup Restify Server
  let server = restify.createServer();

  let connector = new builder.ChatConnector({
      appId: process.env.MICROSOFT_APP_ID,
      appPassword: process.env.MICROSOFT_APP_PASSWORD
  });

  server.post('/api/messages', connector.listen());

  // let consoleConnector = new builder.ConsoleConnector().listen();

  bot.connector('*', connector);

  // Serve the bot
  return new Promise((resolve, reject) => {
    server.listen(serverPort, function (err) {
      if (err) {
        reject(err);
        return;
      }

      console.log('%s listening to %s', server.name, server.url);
      resolve();
    });
  });
})
.catch(err => {
  console.error(err);
});
