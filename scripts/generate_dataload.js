/* eslint-disable max-len */
const conn = require('../helper/connectUtils.js');
const schUtils = require('../helper/schemaUtils.js');
const jsf = require('json-schema-faker');

let mongoClient;

/**
 * deleteSchemaDB - delete schemas from 'schemas' collection.
 * @response {object} - return object {error: err, result: result}.
 */
async function deleteSchemaDB() {
  let result;
  let err = '';
  await require('dotenv').config({path: '../.env'});
  try {
    // Connect to the MongoDB cluster
    mongoClient = await conn.connectToCluster();
    result = await mongoClient.db().collection('schemas').deleteMany({});
    if (!result) {
      throw new Error(`Error saving schema`);
    }
  } catch (e) {
    // console.error(e);
    err = e.message;
  } finally {
    // Close the connection to the MongoDB cluster
    // await mongoClient.close();
    return {error: err, result: result};
  }
}

/**
 * saveSchemaDB - save schema.
 * @param {object} obj - object to be saved
 * @response {object} - return object {error: err, result: result}.
 */
async function saveSchemaDB(obj) {
  let result;
  let err = '';
  await require('dotenv').config();
  try {
    // Connect to the MongoDB cluster
    mongoClient = await conn.connectToCluster();
    result = await mongoClient.db().collection('schemas').insertOne(obj, {returnNewDocument: true});
    if (!result) {
      throw new Error(`Error saving schema`);
    }
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result};
  }
}

/**
 * createApiPayloadExamples - generates payload examples based on a api spec
 * @param {string} urlOas - openAPI specification url
 * @param {int} examplesToBeGenerated - number of examples for each endpoint
 * @response {object} - return object {error: err, result: result}.
 */
async function createApiPayloadExamples(urlOas, examplesToBeGenerated = 20) {
  const objAPI = await schUtils.getApiSpec(urlOas);
  Object.keys(objAPI.paths ?? []).map((pathName) => {
    Object.keys(objAPI.paths[pathName]).map((operationName) => {
      Object.keys(objAPI.paths[pathName][operationName].responses).map((responseCode) => {
        Object.keys(objAPI.paths[pathName][operationName].responses[responseCode].content ?? []).map((contentType) => {
          const schema = objAPI.paths[pathName][operationName].responses[responseCode].content[contentType].schema;
          // console.log({ openApiSpecPath: urlOas, pathName: pathName, operationName: operationName, responseCode: responseCode, contentType: contentType, schema: schema })//,
          const examples = [];
          for (n = 0; n < examplesToBeGenerated; n++) {
            const ret = jsf.generate(schema);
            examples.push(ret);
          }
          saveSchemaDB({openApiSpecPath: urlOas, pathName: pathName, operationName: operationName, responseCode: responseCode, contentType: contentType, schema: schema, examples: examples});
        });
      });
    });
  });
}

(async () => {
  const nbrExamples = (process.argv[2] || '5');
  const origin = (process.argv[3] || 'UK'); // UK or BR or AUS

  const apis = {
    'BR': ['https://raw.githubusercontent.com/OpenBanking-Brasil/openapi/main/swagger-apis/payments/4.0.0-beta.3.yml',
      'https://raw.githubusercontent.com/OpenBanking-Brasil/openapi/main/swagger-apis/automatic-payments/1.0.0-beta.4.yml'
    ],
  };
  // const apis2 = {
  //   'BR': ['https://openbanking-brasil.github.io/openapi/swagger-apis/consents/2.0.1.yml',
  //     'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml',
  //     'https://openbanking-brasil.github.io/openapi/swagger-apis/customers/2.0.1.yml',
  //     'https://openbanking-brasil.github.io/openapi/swagger-apis/credit-cards/2.0.1.yml',
  //     'https://openbanking-brasil.github.io/openapi/swagger-apis/accounts/2.0.1.yml',
  //     'https://openbanking-brasil.github.io/openapi/swagger-apis/loans/2.0.1.yml',
  //     'https://openbanking-brasil.github.io/openapi/swagger-apis/financings/2.0.1.yml',
  //     'https://openbanking-brasil.github.io/openapi/swagger-apis/unarranged-accounts-overdraft/2.0.1.yml',
  //     'https://openbanking-brasil.github.io/openapi/swagger-apis/invoice-financings/2.0.1.yml'],
  //   'AUS': ['https://consumerdatastandardsaustralia.github.io/standards/includes/swagger/cds_banking.json'],
  //   'UK': ['https://raw.githubusercontent.com/OpenBankingUK/read-write-api-specs/master/dist/openapi/account-info-openapi.yaml',
  //     'https://raw.githubusercontent.com/OpenBankingUK/read-write-api-specs/master/dist/openapi/payment-initiation-openapi.yaml',
  //     'https://raw.githubusercontent.com/OpenBankingUK/read-write-api-specs/master/dist/openapi/confirmation-funds-openapi.yaml',
  //     'https://raw.githubusercontent.com/OpenBankingUK/read-write-api-specs/master/dist/openapi/vrp-openapi.yaml',
  //   ],
  // };

  await deleteSchemaDB();
  for (i = 0; i < apis[origin].length; i++) {
    console.log(apis[origin][i]);
    await createApiPayloadExamples(apis[origin][i], parseInt(nbrExamples));
  }
  console.log('Finished');
  await mongoClient.close();
})();
