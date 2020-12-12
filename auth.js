'use strict';

const fetch = require("node-fetch");
const FormData = require('form-data');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();

module.exports.updateToken = async event => {
  const token = await getToken();
  await s3.putObject({
    Bucket: process.env.BUCKET,
    Key: "state",
    Body: JSON.stringify({authToken: token})
  }).promise();
  return token;
};

var getToken = async function (){
  const form = new FormData();
  form.append('user[login]', process.env.PLEX_USERNAME);
  form.append('user[password]', process.env.PLEX_PASSWORD);
  const headers = {
    'X-Plex-Product': 'Plex Status Poller',
    'X-Plex-Version': '1.48.1',
    'X-Plex-Client-Identifier': process.env.PLEX_STATUS_POLLER_CLIENT_IDENTIFIER
  };
  const response = await fetch("https://plex.tv/users/sign_in.json", {method: 'POST', body: form, headers: headers});
  const json = await response.json();
  
  return json.user.authToken
};