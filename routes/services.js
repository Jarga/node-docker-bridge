var express = require('express');
var router = express.Router();
const statusCode = require('http-status-codes')

const http = require('http');
const constants = require('./constants');


var debug = require('debug')('node-docker-bridge:server');

var buildCallback = (res, onResult) => {
  res.setEncoding('utf8');
  let rawData = '';
  res.on('data', (chunk) => {
      rawData += chunk; 
  });
  res.on('end', () => {
      const parsedData = JSON.parse(rawData);
      debug(`Engine request complete: ${JSON.stringify(parsedData)}`)
      onResult(parsedData);
  });
}

/* GET */
router.get('/', function(req, res, next) {
  const options = {
    socketPath: constants.socketPath,
    path: constants.servicesBasePath,
    method: 'GET'
  }

  debug(`Options: ${JSON.stringify(options)}`)

  http.request(options, eRes => buildCallback(eRes, (parsedData) => res.status(statusCode.OK).json(parsedData)))
  .on('error', (e) => {
    debug(e);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: e })
  })
  .end();
  
});

router.post('/scale_up/:name', function(req, res, next) {
  const name = req.params.name
  debug(`Attempting to scale: ${name}`)

  const getOptions = {
    socketPath: constants.socketPath,
    path: constants.servicesBasePath + `/${name}`,
    method: 'GET'
  }
  
  const updateOptions = {
    socketPath: constants.socketPath,
    path: constants.servicesBasePath,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
  }

  let serviceDefReq = http.request(getOptions, eRes => buildCallback(eRes, (parsedData) => {   
      let updateBody = parsedData.Spec
      let max = parsedData.Spec.Labels["com.df.scaleMax"] || 16;

      updateBody.Mode.Replicated.Replicas = Math.min(max, updateBody.Mode.Replicated.Replicas * 2)

      updateOptions.path += `/${parsedData.ID}/update?version=${parsedData.Version.Index}`
      let updateReq = http.request(updateOptions, eRes2 => buildCallback(eRes2, (parsedData2) => res.status(statusCode.OK).json(parsedData2)))
      updateReq.write(JSON.stringify(updateBody))
      updateReq.on('error', (e) => {
        debug(e);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: e })
      })

      updateReq.end()
  }))

  serviceDefReq.on('error', (e) => {
    debug(e);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: e })
  })

  serviceDefReq.end()
  
});

router.post('/scale_down/:name', function(req, res, next) {
  const name = req.params.name
  debug(`Attempting to scale: ${name}`)

  const getOptions = {
    socketPath: constants.socketPath,
    path: constants.servicesBasePath + `/${name}`,
    method: 'GET'
  }
  
  const updateOptions = {
    socketPath: constants.socketPath,
    path: constants.servicesBasePath,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
  }

  let serviceDefReq = http.request(getOptions, eRes => buildCallback(eRes, (parsedData) => {   
      let updateBody = parsedData.Spec
      let min = parsedData.Spec.Labels["com.df.scaleMin"] || 1;

      updateBody.Mode.Replicated.Replicas = Math.max(min, updateBody.Mode.Replicated.Replicas / 2)

      updateOptions.path += `/${parsedData.ID}/update?version=${parsedData.Version.Index}`
      let updateReq = http.request(updateOptions, eRes2 => buildCallback(eRes2, (parsedData2) => res.status(statusCode.OK).json(parsedData2)))
      updateReq.write(JSON.stringify(updateBody))
      updateReq.on('error', (e) => {
        debug(e);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: e })
      })

      updateReq.end()
  }))

  serviceDefReq.on('error', (e) => {
    debug(e);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: e })
  })

  serviceDefReq.end()
  
});

//TODO: Explore streaming api

module.exports = router;
