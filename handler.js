'use strict';

const fetch = require("node-fetch");
var xml2js = require('xml2js');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();

module.exports.hello = async event => {

  // return await getToken();
  return await getServers();

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};

var options = {  // options passed to xml2js parser
  explicitCharkey: false, // undocumented
  trim: false,            // trim the leading/trailing whitespace from text nodes
  normalize: false,       // trim interior whitespace inside text nodes
  explicitRoot: false,    // return the root node in the resulting object?
  emptyTag: null,         // the default value for empty nodes
  explicitArray: true,    // always put child nodes in an array
  ignoreAttrs: false,     // ignore attributes, only create text nodes
  mergeAttrs: false,      // merge attributes and child elements
  validator: null         // a callable validator
};

var getToken = async function(){
  const response = await s3.getObject({
    Bucket: process.env.BUCKET,
    Key: "state"
  }).promise();
  const responseObj = JSON.parse(response.Body.toString('utf-8'));
  return responseObj.authToken;
}

var getServers = async function (){
  const headers = {
    'X-Plex-Token': await getToken()
  }
  var parser = new xml2js.Parser(options);
  try{
    var serversResponse = await fetch('https://plex.tv/pms/servers.xml?includeLite=1', {headers: headers});
    var responseText = await serversResponse.text();
    const result = await new Promise((resolve, reject) => parser.parseString(responseText, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    }));
    var targetServer = result['Server'].filter(function (item) { return item['$']['machineIdentifier'] === process.env.BUCKET; })[0] || null;
    if(targetServer == null) return null;
    return targetServer['$'];
  }catch(error){
    console.log(error);
  }
};