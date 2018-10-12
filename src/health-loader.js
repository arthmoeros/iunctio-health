const fs = require('fs');
const jsYaml = require('js-yaml');
const joiYml = require('joi-yml');
const joi = require('joi');
const p = require('phin').promisified;

const depsSchema = joiYml.getBuilt(`${__dirname}/dependencies-def.yml`);
/**
 * Setup a healthcheck endpoint in the specified Router
 * 
 * @param {Router} expressRouter Express Router reference
 * @param {string} baseURI Base URI where to setup a health endpoint
 * @param {(any|string)} dependenciesDef dependencies to check (can be an object or a yml file name)
 * @param {function} cbLogger Logger callback which receives an string for logging
 */
function setupHealth(expressRouter, baseURI, dependenciesDef, cbLogger) {
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
  expressRouter.get(`${baseURI}/health`, setupHealthHandler(dependenciesDef, cbLogger));
}

function setupHealthHandler(depsDef, cbLogger) {
  let errors = joi.validate(depsDef, depsSchema);
  if (errors && errors.error) {
    throw new Error(errors.error);
  }
  return (request, response) => {
    let depsOK = true;
    let results = [];
    depsDef.dependencies.forEach((dep) => {
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
    });

    if (!depsOK) {
      let failDetails = '';
      results.forEach((result) => {
        if (result.serviceStatus === 'NOK') {
          failDetails += `Service ${result.depName} failed check, expected ${result.expectedStatusCode} but received a ${result.statusCode}\n`;
        }
      })
      cbLogger(`Healthcheck failed, details -> ${failDetails}`);
      response.status(503);
      response.end();
    } else {
      response.status(200);
      response.end();
    }
  };
}

module.exports = setupHealth;