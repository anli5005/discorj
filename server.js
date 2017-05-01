'use strict';

const Discord = require("discord.js");
const MongoClient = require("mongodb").MongoClient;
const apiai = require("apiai");

const searchprovider = require("./searchprovider");
const mediaplayer = require("./mediaplayer");

var bot = new Discord.Client();
var app;
var player;

module.exports = {};

const intentHandlers = {
  "play": function(message, data, db, config) {
    db.collection("current").findOne({_id: message.guild.id}, {fields: {channel: 1}}).then(function(playingVideo) {
      if (playingVideo || message.member.voiceChannel) {
        searchprovider.resolveVideo(data.parameters.videoName, config.youtube.token).then(function(metadata) {
          var channel = (playingVideo && playingVideo.channel) ? playingVideo.channel : message.member.voiceChannel.id;
          console.log({_id: message.guild.id, channel: channel, name: metadata.name, url: metadata.url, paused: false});
          db.collection("current").updateOne({_id: message.guild.id}, {_id: message.guild.id, channel: channel, name: metadata.name, url: metadata.url, paused: false}).then(function(result) {
            if (result.result.n < 1) {
              return db.collection("current").insertOne({_id: message.guild.id, channel: channel, name: metadata.name, url: metadata.url, paused: false});
            } else {
              return Promise.resolve();
            }
          }).then(function() {
            player.beginPlaying(message.guild.id);
          }).catch(function(error) {
            console.log(error.stack);
          });
          message.channel.send("Playing " + metadata.name + " on " + bot.channels.get(channel).name + "...");
        }).catch(function(error) {

        });
      } else {
        message.channel.send("You'll need to join a voice channel before you can play songs.");
      }
    });
  },
  "pause": function(message, data, db) {
    db.collection("current").findOne({_id: message.guild.id}, {fields: {paused: 1}}).then(function(playingVideo) {
      if (playingVideo && !playingVideo.paused) {
        db.collection("current").updateOne({_id: message.guild.id}, {paused: true}).then(function() {
          player.pause(message.guild.id);
        });
        message.channel.send("Okay, I've paused the music.")
      } else {
        message.channel.send("Trying to pause... nothing. Play something first.");
      }
    });
  },
  "fallback": function(message, data, db) {
    message.channel.send("I didn't understand what you said.");
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

      player = new mediaplayer(bot, db);
    });

    bot.on("message", function(message) {
      if (message.content.startsWith("<@" + bot.user.id + ">") && message.guild) {
        db.collection("sessions").findOne({guild: message.guild.id, member: message.member.id}, {fields: {id: 1}}).then(function(data) {
          if (data) {
            return Promise.resolve(data._id);
          } else {
            return db.collection("sessions").insertOne({guild: message.guild.id, member: message.member.id}).then(function(result) {
              return Promise.resolve(result.insertedId);
            });
          }
        }).then(function(sessionId) {
          app.textRequest(message.content.replace("<@" + bot.user.id + ">", ""), {
            sessionId: sessionId
          }).on("response", function(response) {
            if (intentHandlers[response.result.metadata.intentName]) {
              intentHandlers[response.result.metadata.intentName](message, response.result, db, config);
            } else {
              message.channel.send("I can't do that right now, but it's coming soon! Stay tuned.")
            }
          }).on("error", function(error) {
            console.log("=== ERROR ===");
            console.log(error);
            console.log("=============");

            message.channel.send("I'm sorry, but there was an error proccessing your request. Please try again.")
          }).end();
        });
      }
    });

    bot.login(config.discord.botToken);

  });
};
