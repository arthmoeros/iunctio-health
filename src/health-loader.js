const fs = require('fs');
const jsYaml = require('js-yaml');
const joiYml = require('joi-yml');
const joi = require('joi');
const p = require('phin').promisified;
const express = require('express');

const depsSchema = joiYml.getBuilt(`${__dirname}/dependencies-def.yml`);
/**
 * Setup a healthcheck endpoint in the specified Router
 * 
 * @param {express.Router} expressRouter Express Router reference
 * @param {string} baseURI Base URI where to setup a health endpoint
 * @param {(any|string)} dependenciesDef dependencies to check (can be an object or a yml file name)
 * @param {*} logger Logger object that must implement the *info, warn and error* methods
 */
function setupHealth(expressRouter, baseURI, dependenciesDef, logger) {
  if (typeof (dependenciesDef) === 'string') {
    if (!dependenciesDef.startsWith('/')) {
      dependenciesDef = `${process.cwd()}/${dependenciesDef}`;
    }
    if (!fs.existsSync(dependenciesDef)) {
      throw new Error(`Health dependencies file doesn't exists -> ${dependenciesDef}`);
    }
    if (!dependenciesDef.endsWith('.yml') || !dependenciesDef.endsWith('.yaml')) {
      throw new Error(`Health dependencies file is not a YAML file -> ${dependenciesDef}`);
    }
    dependenciesDef = jsYaml.load(fs.readFileSync(dependenciesDef));
  }
  expressRouter.get(`/${baseURI}/health`, setupHealthHandler(dependenciesDef, logger));
  logger.info(`RIK_HEALTH: Setup a Healthcheck endpoint at '/${baseURI}/health'`);
}

function setupHealthHandler(depsDef, logger) {
  let errors = joi.validate(depsDef, depsSchema);
  if (errors && errors.error) {
    throw new Error(errors.error);
  }
  return (request, response) => {
    _checkDependencies(depsDef).then(({depsOK, results}) => {
      if (!depsOK) {
        let failDetails = '';
        results.forEach((result) => {
          if (result.serviceStatus === 'NOK') {
            failDetails += `Service ${result.depName} failed check, expected ${result.expectedStatusCode} but received a ${result.statusCode}\n`;
          }
        })
        logger.error(`RIK_HEALTH: Healthcheck failed, details -> ${failDetails}`);
        response.status(503);
        response.end();
      } else {
        response.status(200);
        response.end();
      }
    }).catch((err) => {
      logger.error(`RIK_HEALTH: Healthcheck failed, details -> ${err}`);
      response.status(503);
      response.end();
    });
  };
}

async function _checkDependencies(depsDef){
  let depsOK = true;
  let results = [];
  for(let i = 0; i < depsDef.dependencies.length > 0; i += 1){
    let dep = depsDef.dependencies[i];
    let response;
    try {
      response = await p({
        url: dep.endpoint,
        timeout: dep.timeout
      });
    } catch (error) {
      response = {
        statusCode: error.message
      };
    }
    results.push({
      depName: dep.name,
      expectedStatusCode: dep.expectedStatusCode,
      statusCode: response.statusCode,
      serviceStatus: response.statusCode === dep.expectedStatusCode ? 'OK' : 'NOK'
    });
    if (depsOK) {
      depsOK = response.statusCode === dep.expectedStatusCode;
    }
  }
  return {depsOK, results};
}

module.exports = setupHealth;