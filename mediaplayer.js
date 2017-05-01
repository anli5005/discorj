const ytdl = require("ytdl-core");

class MediaPlayer {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
    this.activeStreams = {};
  }
  beginPlaying(guild) {
    var bot = this.bot;
    var db = this.db;
    var activeStreams = this.activeStreams;

    db.collection("current").findOne({_id: guild}, {fields: {channel: 1, name: 1, url: 1}}).then(function(video) {
      bot.channels.get(video.channel).join().then(function(connection) {
        const stream = ytdl(video.url, {filter: "audioonly"});
        activeStreams[guild] = connection.playStream(stream);
      })
    }).catch(function(e) {
      console.log(e.stack);
    });
  }
  pause(guild) {
    var bot = this.bot;
    var db = this.db;
    var activeStreams = this.activeStreams;

    activeStreams[guild].pause();
  }
}

module.exports = MediaPlayer;
