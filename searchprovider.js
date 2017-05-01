const google = require("googleapis");
const youtube = google.youtube("v3");

const validUrl = require("valid-url");

module.exports = {};

module.exports.resolveVideo = function(video, key) {
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
          resolve({name: item.snippet.title, url: "https://youtube.com/watch?v=" + item.id.videoId});
        }
      });
    }
  });
};
