const google = require("googleapis");
const youtube = google.youtube("v3");

const Discord = require("discord.js");
const validUrl = require("valid-url");

module.exports = {};

module.exports.resolveVideo = function(video, key, msg) {
  return new Promise(function(resolve, reject) {
    console.log(video);
    if (validUrl.isUri(video)) {
      var match = video.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/);
      if (!match) {
        reject("not_youtube_url");
      }
      var id = match[7];
      youtube.videos.list({
        part: "snippet",
        id: id,
        auth: key
      }, function(error, data) {
        if (error) {
          throw error;
        } else if (data && data.items.length < 1) {
          reject("no_results_found");
        } else if (data) {
          resolve({name: data.items[0].snippet.title, url: "https://youtube.com/watch?v=" + id});
        }
      });
    } else {
      youtube.search.list({
        part: "id,snippet",
        q: video,
        auth: key
      }, function(error, data) {
        if (error) {
          throw error;
        } else if (data && data.items.length < 1) {
          reject("no_results_found");
        } else if (data) {
          var item = data.items[0];
          var url = "https://youtube.com/watch?v=" + item.id.videoId;
          module.exports.showConfirmationMessage(item, url, msg).then(function() {
            resolve({name: item.snippet.title, url: url});
          }).catch(function(e) {
            console.log(e.stack);
            if (e === "cancelled") {
              //reject("cancelled");
            }
          })
        }
      });
    }
  });
};

module.exports.showConfirmationMessage = function(video, url, msg) {
  console.log(video);
  return new Promise(function(resolve, reject) {
    var embed = new Discord.RichEmbed();

    embed.setTitle(video.snippet.title);
    embed.setURL(url);
    embed.setFooter("Adding in 5 seconds...");

    if (video.snippet.thumbnails && video.snippet.thumbnails.high) {
      embed.attachFile(video.snippet.thumbnails.high.url);
    }

    var timeout;
    var collector;

    msg.channel.send("Is this correct?", {
      embed: embed
    }).then(function(message) {
      collector = message.createReactionCollector(function(reaction, user) {
        return user.id === msg.member.id && (reaction.emoji.name === "✅" || reaction.emoji.name === "❌");
      }).on("collect", function(reaction) {
        collector.stop();
        if (timeout) {
          clearTimeout(timeout);
        }
        var shouldResolve = (reaction.emoji.name === "✅");
        message.delete();

        shouldResolve ? resolve() : reject("cancelled");
      });

      return Promise.all([
        message.react("✅"),
        message.react("❌")
      ]);
    }).then(function(reactions) {
      timeout = setTimeout(function() {
        collector.stop();
        reactions[0].message.delete();
        resolve();
      }, 5000);
    }).catch(function(e) {
      console.log(e.stack);
      reject(e);
    });
  });
};
