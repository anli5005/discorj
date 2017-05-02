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

function sendQueueMessage(message, playNext) {
  message.channel.send(playNext ? "Song playing next." : "Sure, I'll queue that song for you.");
}

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

  "resume": function(message, data, db) {
    db.collection("current").findOne({_id: message.guild.id}, {fields: {paused: 1}}).then(function(playingVideo) {
      if (playingVideo && playingVideo.paused) {
        db.collection("current").updateOne({_id: message.guild.id}, {paused: false}).then(function() {
          player.resume(message.guild.id);
        });
        message.channel.send("Playing music...");
      } else if (message.content.includes("play")) {
        message.channel.send("What video would you like to play?")
      } else if (playingVideo) {
        message.channel.send("Something's already playing.")
      } else {
        message.channel.send("You'll need to play something first.")
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

  "skip": function(message, data, db) {
    player.skip(message.guild.id);
    message.channel.send("Song skipped.");
  },

  "queue": function(message, data, db, config, playNext) {
    db.collection("queues").findOne({_id: message.guild.id}, {fields: {queue: 1}}).then(function(result) {
      if (result) {
        console.log("Updating queue...");
        searchprovider.resolveVideo(data.parameters.videoName, config.youtube.token).then(function(metadata) {
          db.collection("queues").updateOne({_id: message.guild.id}, {$set: {queue: playNext ? [metadata].concat(result.queue) : result.queue.concat([metadata])}});
        });
        sendQueueMessage(message, playNext);
      } else {
        db.collection("current").findOne({_id: message.guild.id}, {fields: {_id: 1}}).then(function(current) {
          if (current) {
            console.log("Making new queue...");
            searchprovider.resolveVideo(data.parameters.videoName, config.youtube.token).then(function(metadata) {
              db.collection("queues").insertOne({_id: message.guild.id, queue: [metadata]});
            });
            sendQueueMessage(message, playNext);
          } else {
            console.log("Playing song...");
            intentHandlers["play"](message, data, db, config);
          }
        });
      }

    });
  },

  "playnext": function(message, data, db, config) {
    intentHandlers.queue(message, data, db, config, true);
  },

  "nowplaying": function(message, data, db) {
    db.collection("current").findOne({_id: message.guild.id}, {fields: {name: 1}}).then(function(playingVideo) {
      if (playingVideo) {
        message.channel.send("Right now, \"" + playingVideo.name + "\" is playing.");
      } else {
        message.channel.send("Right now, a hit single called _nothing_ is playing.")
      }
    });
  },

  "showqueue": function(message, data, db) {
    db.collection("queues").findOne({_id: message.guild.id}, {fields: {queue: 1}}).then(function(queue) {
      var i = 0;
      queue ? message.channel.send("Here's what's in the queue:\n\n" + queue.queue.map(function(song) {
        i++;
        return i + ") " + song.name;
      }).join("\n")) : message.channel.send("The queue is empty. Play something!");
    });
  },

  "add": function(message, data, db, config) {
    message.channel.send("Add me to your server here: " + config.addLink);
  },

  "clear": function(message, data, db) {
    db.collection("queues").deleteOne({_id: message.guild.id});
    message.channel.send("I've cleared the entire queue.");
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
            if (intentHandlers[response.result.action]) {
              intentHandlers[response.result.action](message, response.result, db, config);
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
