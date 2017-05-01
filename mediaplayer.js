const ytdl = require("ytdl-core");

class MediaPlayer {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
    this.activeStreams = {};
  }

  nextSong(guild) {
    var player = this;

    this.db.collection("queues").findOne({_id: guild}, {fields: {queue: 1}}).then(function(data) {
      console.log("Here's the queue:");
      console.log(data);
      if (data && data.queue && data.queue.length > 0) {
        console.log("What's next:");
        var next = data.queue[0];

        var operation;
        if (data.queue.length > 1) {
          operation = player.db.collection("queues").updateOne({_id: guild}, {queue: data.queue.slice(1)});
        } else {
          operation = player.db.collection("queues").deleteOne({_id: guild});
        }

        Promise.all([
          operation,
          player.db.collection("current").findOne({_id: guild}, {fields: {channel: 1}}).then(function(r) {
            return player.db.collection("current").updateOne({_id: guild}, {$set: {name: next.name, url: next.url, channel: r.channel}});
          })
        ]).then(function() {
          player.beginPlaying(guild);
        });
      } else {
        player.db.collection("current").deleteOne({_id: guild});
      }
    });
  }

  skip(guild) {
    this.activeStreams[guild].end();
  }

  play(video, guild) {
    var player = this;

    this.bot.channels.get(video.channel).join().then(function(connection) {
      const stream = ytdl(video.url, {filter: "audioonly"});
      player.activeStreams[guild] = connection.playStream(stream);
      player.activeStreams[guild].on("end", function() {
        player.nextSong(guild);
      });
    })
  }

  beginPlaying(guild) {
    var player = this;

    this.db.collection("current").findOne({_id: guild}, {fields: {channel: 1, name: 1, url: 1}}).then(function(video) {
      console.log(video);
      player.play(video, guild);
    }).catch(function(e) {
      console.log(e.stack);
    });
  }

  resume(guild) {
    var bot = this.bot;
    var db = this.db;
    var activeStreams = this.activeStreams;

    activeStreams[guild].resume();
  }

  pause(guild) {
    var bot = this.bot;
    var db = this.db;
    var activeStreams = this.activeStreams;

    activeStreams[guild].pause();
  }
}

module.exports = MediaPlayer;
