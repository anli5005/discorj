'use strict';

const fs = require("fs");

console.log("Reading config...");

let config = JSON.parse(fs.readFileSync("config.json", {encoding: "utf-8"}));
console.log(config);

let server = require("./server");
let sessions = [];
server.start(config, sessions);
