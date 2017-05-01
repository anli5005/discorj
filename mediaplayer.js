const ytdl = require("ytdl-core");

class MediaPlayer {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
    this.activeStreams = {};
  }

  skip(guild) {
    // For now, stop playing.
    this.db.collection("current").deleteOne({_id: guild});
    if (this.activeStreams[guild] && !this.activeStreams[guild].destroyed) {
      this.activeStreams[guild].end();
    }
  }

  play(video, guild) {
    var player = this;

    this.bot.channels.get(video.channel).join().then(function(connection) {
      const stream = ytdl(video.url, {filter: "audioonly"});
      player.activeStreams[guild] = connection.playStream(stream);
      player.activeStreams[guild].on("end", function() {
        player.skip(guild);
      });
    })
  }

  beginPlaying(guild) {
    var player = this;

    this.db.collection("current").findOne({_id: guild}, {fields: {channel: 1, name: 1, url: 1}}).then(function(video) {
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
