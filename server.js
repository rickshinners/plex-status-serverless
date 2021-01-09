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

  const recentlyAddedMovies = await getRecentlyAddedMovies(ip, port, token);
  retval.recentlyAddedMovies = transformRecentlyAdded(recentlyAddedMovies);

  const recentlyAddedSeries = await getRecentlyAddedSeries(ip, port, token);
  retval.recentlyAddedSeries = transformRecentlyAdded(recentlyAddedSeries);
  

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
      newSession.title = transformMetadataToTitle(session);
      transformedSessions.push(newSession);
    }
  });
  return transformedSessions;
}

var transformMetadataToTitle = function(metadata){
  if(metadata.type === 'movie'){
    return `${metadata.title} (${metadata.year})`;
  }
  if(metadata.type === 'episode'){
    return `${metadata.grandparentTitle} - S${metadata.parentIndex}E${metadata.index} - ${metadata.title}`;
  }
  if(metadata.type === 'season'){
    return `${metadata.parentTitle} - ${metadata.title}`;
  }
  if(metadata.type === 'show'){
    return `${metadata.title} - ${metadata.childCount} Seasons`;
  }
  return `${metadata.title} [UNKNOWN MEDIA TYPE]`
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

var getRecentlyAddedMovies = async function(ip, port, token){
  const headers = {
    'Accept': 'application/json',
    'X-Plex-Token': token,
    'X-Plex-Container-Size': 10,
    'X-Plex-Container-Start': 0
  };
  const response = await fetch(`http://${ip}:${port}/hubs/home/recentlyAdded?type=1`, {headers: headers});
  const responseJson = await response.json();
  if(responseJson.MediaContainer.size === 0) return []
  return responseJson.MediaContainer.Metadata;
}

var getRecentlyAddedSeries = async function(ip, port, token){
  const headers = {
    'Accept': 'application/json',
    'X-Plex-Token': token,
    'X-Plex-Container-Size': 10,
    'X-Plex-Container-Start': 0
  };
  const response = await fetch(`http://${ip}:${port}/hubs/home/recentlyAdded?type=2&includeCollections=1`, {headers: headers});
  const responseJson = await response.json();
  if(responseJson.MediaContainer.size === 0) return []
  return responseJson.MediaContainer.Metadata;
}

var transformRecentlyAdded = function(recentlyAdded){
  const transformedRecentlyAdded = [];
  if(recentlyAdded === undefined || recentlyAdded === null) return recentlyAdded;
  recentlyAdded.forEach(recentlyAdded =>{
    transformedRecentlyAdded.push(transformMetadataToTitle(recentlyAdded))
  });
  return transformedRecentlyAdded;
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
