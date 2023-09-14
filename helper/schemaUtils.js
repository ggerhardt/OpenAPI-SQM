/* eslint-disable max-len */
const SwaggerParser = require('@readme/openapi-parser');

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const localize = require('ajv-i18n');
const {openapiSchemaToJsonSchema: toJsonSchema} = require('@openapi-contrib/openapi-schema-to-json-schema');
const logger = require('pino')({
  level: process.env.LOG_LEVEL??'info',
});

const apiList = [];
const schemaList = [];
const ajv = new Ajv({allErrors: true, verbose: true, strict: false, formats: {integer: true}});// strict: 'log',
addFormats(ajv);
ajv.addVocabulary(['example']);

/**
 * getApiSpec - get openApi, derefence and validate it and cache it.
 * @param {string} openApiSpecPath - url to the OpenAPI spec
 * @return {object} the OpenAPI spec object
 */
async function getApiSpec(openApiSpecPath) {
  if (Object.hasOwn(apiList, openApiSpecPath)) {
    return apiList[openApiSpecPath];
  } else {
    try {
      await SwaggerParser.validate(openApiSpecPath);
    } catch (err) {
      logger.debug(err.message);
      throw new Error('[error validating API Spec] ' + err.message);
    }
    try {
      const openApiSpec = await SwaggerParser.dereference(openApiSpecPath, {
        continueOnError: true, // Don't throw on the first error
        dereference: {
          circular: false, // Don't allow circular $refs
        },
        validate: {
          spec: false,
        }, // Don't validate against the Swagger spec
      });
      apiList[openApiSpecPath] = openApiSpec;
      return openApiSpec;
    } catch (err) {
      throw new Error('[error dereferencing] ' + err.message);
    }
  }
}

/**
 * getApiPath Tries to identify the path called by the url
 * @param {string} url - url that called an implementation of a OpenAPI Spec
 * @param {object} apiSpec - object of the OpenAPI spec
 * @return {string} the OpenAPI spec object
 */
function getApiPath(url, apiSpec) {
  if (!apiSpec) {
    return '';
  }
  const apiPaths = Object.keys(apiSpec.paths);
  const urlSemParm = url.split('?');
  const urlArr = urlSemParm[0].split('/');
  let idxChosen = -1;
  let CountComparisonChoosen = 0;
  for (let i = 0; i < apiPaths.length; i++) {
    const pathArr = apiPaths[i].split('/');
    if (pathArr.length <= urlArr.length) { // if url has less items than the path, move on to the next one
      // check tokens backwards
      let checkOk = true;
      let countComp = 0;
      for (let j = 0; j < pathArr.length; j++) {
        const idx = -1 - j; // deve ir -1,-2,-3...
        if ((pathArr[pathArr.length + idx].indexOf('{') == -1) && (pathArr[pathArr.length + idx] != '')) {
          if (pathArr[pathArr.length + idx] != urlArr[urlArr.length + idx]) {
            checkOk = false;
          } else {
            countComp++;
          }
        }
      }
      if ((checkOk) && (countComp > CountComparisonChoosen)) {
        idxChosen = i;
        CountComparisonChoosen = countComp;
      }
    }
  }
  return (idxChosen == -1) ? '' : apiPaths[idxChosen];
}

/**
 * getSchemaUrl - gets the schema, receiving the url called to infer the path
 * @param {string} openApiSpecPath - url of a OpenAPI specification
 * @param {string} url - url that called an implementation of a OpenAPI Spec
 * @param {string} operationName - operation used on the call: GET, POST, ...
 * @param {string} responseCode - response code received by the call
 * @param {string} contentType - content type of the response
 * @return {object} the schema object related to the request
 */
async function getSchemaUrl(openApiSpecPath, url, operationName,
    responseCode, contentType) {
  const apiSpec = await getApiSpec(openApiSpecPath);
  const pathName = getApiPath(url, apiSpec);
  if (pathName != '') {
    return await getSchema(openApiSpecPath,
        pathName, operationName, responseCode, contentType);
  } else {
    throw new Error('Couldn\'t find url\'s path in schema');
  }
}

/**
 * getSchema - gets the schema of a OpenAPI spec
 * @param {string} openApiSpecPath - url of a OpenAPI specification
 * @param {string} pathName - path of a OpenAPI Spec resource
 * @param {string} operationName - operation used on the call: GET, POST, ...
 * @param {string} responseCode - response code received by the call
 * @param {string} contentType - content type of the response
 * @return {object} the schema object related to the request
 */
async function getSchema(openApiSpecPath, pathName, operationName,
    responseCode, contentType) {
  const apiSpec = await getApiSpec(openApiSpecPath);
  let apiName = '';
  let apiVersion = '';
  apiName = apiSpec.info?.title;
  apiVersion = apiSpec.info?.version;
  if (pathName != '') {
    const path = getKeyObj(apiSpec.paths, pathName); // looks for the same key, but with spaces and/or different cases
    if (!path) {
      throw new Error(`Path '${pathName}' not found in the specification`);
    }
    const pathObj = apiSpec.paths[path];

    const operation = getKeyObj(pathObj, operationName);
    if (!operation) {
      throw new Error(`Operation '${pathName}/${operationName}' not found in the specification`);
    }
    const operationObj = pathObj[operation];

    let response = findKeyObj(operationObj.responses, responseCode);
    if (!response) {
      response = findKeyObj(operationObj.responses, 'default');
      if (!response) {
        throw new Error(`Code '${pathName}/${operationName}/${responseCode}' not found in the specification`);
      }
    }
    const responseObj = operationObj.responses[response];

    //
    let contentObj;
    let schema;
    let content;
    if (!responseObj.schema) {
      content = findKeyObj(responseObj.content ?? [], contentType);
      if (!content) {
        content = findKeyObj(responseObj.content ?? [], 'application/json');
        if (!content) {
          throw new Error(`Content type '${pathName}/${operationName}/${responseCode}/${contentType}' not found in the specification`);
        }
      }
      contentObj = responseObj.content[content];
      if (!contentObj.schema) {
        throw new Error('Schema not found in the specification');
      }
      schema = contentObj.schema;
    } else {
      schema = responseObj.schema;
    }

    const schemaId = `${openApiSpecPath.toLowerCase()}_${path}_${operation}_${response}_${content}`;
    if (Object.hasOwn(schemaList, schemaId)) {
      return schemaList[schemaId];
    }
    const jsonSchema = toJsonSchema(schema); // (apiSpec.openapi.indexOf("3.0") == 0) ? toJsonSchema(schema) : schema;  //convert to json schema //json-schema-migrate???
    delete (jsonSchema.$defs);
    delete (jsonSchema.$id);
    delete (jsonSchema.$schema);
    schemaList[schemaId] = {
      schemaId: schemaId,
      apiName: apiName + ' ' + apiVersion,
      path: path,
      operation: operation,
      response: response,
      content: content,
      schema: jsonSchema,
    };
    ajv.addSchema(jsonSchema, schemaId);
    return schemaList[schemaId];
  }
}

/**
 * validatePayload - executes schema validations (calls ajv functions)
 * @param {string} schemaId - identification of the schema
 * @param {object} payload - payload to be verified

 * @return {object} - structure {validSchema: true/false, errors: [*]]}
 */
function validatePayload(schemaId, payload) {
  let validate;
  let valid;
  try {
    validate = ajv.getSchema(schemaId);
    valid = validate(payload);
  } catch (err) {
    logger.debug(`Error processing payload: ${err.message}`);
    return {validSchema: false, errors: [], errorProcessingPayload: err.message};
  }
  try {
    if (!valid) {
      if (process.env.AJV_MESSAGE_LOCALIZATION) {
        localize[process.env.AJV_MESSAGE_LOCALIZATION](validate.errors);
      }
      validate.errors.map((item) => {
        if (item.instancePath == '') { // root showed as '/'
          item.instancePath = '/';
        }
        item.genInstancePath = item.instancePath.replaceAll(/\/(\d)+/g, '/[]');
      });
      const errorAgg = validate.errors.reduce((aggErr, item, id, arr) => {
        const idx = aggErr.findIndex((itemAgg) => {
          if ((itemAgg.genInstancePath == item.genInstancePath) && (itemAgg.message == item.message)) {
            return true;
          } else {
            return false;
          }
        });
        if (idx > -1) {
          aggErr[idx].count++;
          if (process.env.AJV_ALL_ERRORS && process.env.AJV_ALL_ERRORS == 'TRUE') {
            aggErr[idx].allInstances.push({...item});
          }
        } else {
          let simpleVal = '';
          if (item.keyword == 'type') {
            if (typeof (item.data) == 'string') {
              simpleVal = `'${item.data}' (string)`;
            } else if (typeof (item.data) == 'number') {
              simpleVal = `${item.data} (number)`;
            } else if (item.data == null) {
              simpleVal = `(null)`;
            } else {
              simpleVal = `(${typeof (item.data)})`;
            }
          } else if (item.keyword == 'additionalProperties') {
            simpleVal = item.params.additionalProperty??'';
          } else if (item.keyword == 'enum') {
            simpleVal = item.data + ' not in ' + JSON.stringify(item.params.allowedValues);
          } else if (item.keyword == 'required') {
            simpleVal = item.params.missingProperty??'';
          } else {
            simpleVal = item.data;
          }
          const errLog = {'genInstancePath': item.genInstancePath, 'message': item.message, 'count': 1, 'keyword': item.keyword, 'instancePathExample': item.instancePath, 'instanceValueExample': simpleVal};
          if (process.env.AJV_ALL_ERRORS && process.env.AJV_ALL_ERRORS == 'TRUE') {
            errLog.allInstances = [{...item}];
          }
          aggErr.push(errLog);
        }
        return aggErr;
      }, []);
      return {validSchema: false, errors: errorAgg};
    }
  } catch (err) {
    logger.debug(`Error processing validations details: ${err.message}`);
    return {valid_schema: false, errors: [], error_processing_payload: err.message};
  }

  return {validSchema: true, errors: undefined};
}

/**
 * findKeyObj - searchs for str inside obj attributes names. eg. As key, the object can have  'application/json; charset=utf-8', and you are looking for 'json'
 * @param {object} obj - object
 * @param {string} str - string being searched
 * @return {string} - key of the attribute that has the str
 */
function findKeyObj(obj, str) {
  const found = Object.keys(obj).find((item) => {
    return item.toLowerCase().indexOf(str.toLowerCase()) > -1;
  });
  return found;
}

/**
 * getKeyObj - search attributes names in the object, disregarding trailling spaces and word cases
 * @param {object} obj - object
 * @param {string} attr - attribute being searched
 * @return {string} - key of the attribute found
 */
function getKeyObj(obj, attr) {
  const found = Object.keys(obj).find((item) => {
    return item.toLowerCase().trim() == attr.toLowerCase().trim();
  });
  return found;
}

exports.getApiSpec = getApiSpec;
exports.getApiPath = getApiPath;
exports.findKeyObj = findKeyObj;
exports.getKeyObj = getKeyObj;
exports.getSchemaUrl = getSchemaUrl;
exports.getSchema = getSchema;
exports.validatePayload = validatePayload;
