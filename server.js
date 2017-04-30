'use strict';

const Discord = require("discord.js");
const MongoClient = require("mongodb").MongoClient;
const apiai = require("apiai");

var bot = new Discord.Client();
var app;

module.exports = {};

const intentHandlers = {
  "play": function(message, data) {
    message.channel.send("Playing " + data.parameters.videoName + "...");
  }
};

module.exports.start = function(config, sessions) {
  app = apiai(config.apiai.token);

  new Promise(function(resolve, reject) {
    MongoClient.connect(config.mongodb.url, function(error, db) {
      error ? reject(error) : resolve(db);
    });
  }).then(function(db) {

    bot.on("ready", function() {
      console.log("Connected to Discord");
    });

    bot.on("message", function(message) {
      if (message.content.startsWith("<@" + bot.user.id + ">") && message.guild) {
        var sessionId = sessions.indexOf(message.guild.id + "?" + message.member.id);
        if (sessionId === -1) {
          sessionId = sessions.length;
        }

        console.log(message.guild.id + "?" + message.member.id);

        app.textRequest(message.content.replace("<@" + bot.user.id + ">", ""), {
          sessionId: sessionId
        }).on("response", function(response) {
          if (intentHandlers[response.result.metadata.intentName]) {
            intentHandlers[response.result.metadata.intentName](message, response.result);
          } else {
            message.channel.send("I can't do that right now, but it's coming soon! Stay tuned.")
          }
        }).on("error", function(error) {
          console.log("=== ERROR ===");
          console.log(error);
          console.log("=============");

          message.channel.send("I'm sorry, but there was an error proccessing your request. Please try again.")
        }).end();
      }
    });

    bot.login(config.discord.botToken);

  });
};
