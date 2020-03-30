const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const axios = require('axios');
const https = require('https');


const afetch = axios.create({
  baseURL: 'http://localhost',
  timeout: 5000,
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  }),
});

const parseUrl = (url) => {
  let u;
  if (url.toLowerCase().startsWith("http")) {
    u = new URL(url);
  } else {
    u = new URL(url, "place://holder");
  }
  const pathName = u.pathname;
  const args = {};
  u.searchParams.forEach((v, k) => {
      args[k] = v;
  });
  return {
      pathName,
      args
  };
}

const dispatchHandler = async (payload, client) => {
  let req = {};
  let success = true;
  let message = "";
  let response = {};
  try {
    req = parseUrl(payload);
    response = (await afetch.get(req.pathName, req.args)).data;
  } catch(error) {
    message = error ? error.toString() : "Unknown error";
    success = false;
  } finally {
    client.send(JSON.stringify({
      pathName: req.pathName,
      success,
      message,
      response
    }));
  }
}

io.on('connection', client => {
  console.log(client.id, 'connect');
  client.on('message', message => { dispatchHandler(message, client); });
  client.on('disconnect', () => { console.log(client.id, 'disconnect'); });
});

server.listen(8575, '0.0.0.0', () => {
    console.log("quickbox-ws running...");
});
