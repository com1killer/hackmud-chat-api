#!/usr/bin/env node
var fetch = require("node-fetch");
if (process.argv.length < 3) return console.log("Usage: $0 <chat pass>");

var pass = process.argv[2];
console.log("Chat pass:", pass);

fetch("https://www.hackmud.com/mobile/get_token.json", {
    method: "POST",
    body: JSON.stringify({
        pass
    }),
    headers: { 'Content-Type': 'application/json' }
}).then(x => {
    x.json().then(dat => {
        if (x.status < 200 || x.status >= 400) throw x.status + "\n" + JSON.stringify(dat);
        else console.log("Chat token:", dat.chat_token);
    }).catch(err => {
        console.error("An error occurred:", err);
    })
}).catch(err => {
    console.error("An error occurred:", err);
})