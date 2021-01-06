'use strict';

const fetch = require("node-fetch");
var xml2js = require('xml2js');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();

module.exports.getStats = async event => {
  const retval = {};
  const token = await getToken();
  const serverInfoFromPlex = await getPlexHostedServerInfo(token, process.env.TARGET_MACHINE_IDENTIFIER);
  const ip = serverInfoFromPlex.address;
  const port = serverInfoFromPlex.port;

  const servoInfo = await getServoInfo(ip, port, token);
  retval.name = servoInfo.friendlyName;

  const sessions = await getSessions(ip, port, token);
  retval.currentSessions = transformSessions(sessions);

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(retval)
  };
};

var transformSessions = function(sessions){
  const transformedSessions = []
  if(sessions === undefined || sessions === null) return transformedSessions;
  sessions.forEach(session =>{
    if(session.Player.state === 'playing'){
      const newSession = {
        type: session.type,
        bandwidth: session.Session.bandwidth
      }
      if(session.type === 'movie'){
        newSession.title = `${session.title} (${session.year})`;
      }else if(session.type === 'episode'){
        newSession.title = `${session.grandparentTitle} - S${session.parentIndex}E${session.index} - ${session.title}`;
      }else{
        newSession.title = `${session.title} [UNKNOWN SESSION TYPE]`
      }
      transformedSessions.push(newSession);
    }
  });
  return transformedSessions;
}

var getSessions = async function(ip, port, token){
  const headers = {
    'Accept': 'application/json',
    'X-Plex-Token': token
  };
  const response = await fetch(`http://${ip}:${port}/status/sessions`, {headers: headers});
  const responseJson = await response.json();
  if(responseJson.MediaContainer.size === 0) return [];
  return responseJson.MediaContainer.Metadata;
}

var getServoInfo = async function(ip, port, token){
  const headers = {
    'Accept': 'application/json',
    'X-Plex-Token': token
  };
  const response = await fetch(`http://${ip}:${port}/`, {headers: headers});
  const responseJson = await response.json();
  return responseJson.MediaContainer;
}

var getToken = async function(){
  const response = await s3.getObject({
    Bucket: process.env.BUCKET,
    Key: "state"
  }).promise();
  const responseObj = JSON.parse(response.Body.toString('utf-8'));
  return responseObj.authToken;
}

var getPlexHostedServerInfo = async function (authToken, machineIdentifier){
  const headers = {
    'X-Plex-Token': authToken
  }  
  const parser = new xml2js.Parser({
    explicitArray: true,
    explicitRoot: false
  });
  try{
    var serversResponse = await fetch('https://plex.tv/pms/servers.xml?includeLite=1', {headers: headers});
    var responseText = await serversResponse.text();
    const result = await new Promise((resolve, reject) => parser.parseString(responseText, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    }));
    var targetServer = result['Server'].filter(function (item) { return item['$']['machineIdentifier'] === machineIdentifier; })[0] || null;
    if(targetServer == null) return null;
    return targetServer['$'];
  }catch(error){
    console.log(error);
  }
};
