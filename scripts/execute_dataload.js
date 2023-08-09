/* eslint-disable max-len */
const conn = require('../helper/connectUtils.js');

const axios = require('axios').default;
let mongoClient;

/**
 * LoadSchemaListDB - load schemas.
 * @response {object} - return object {error: err, result: result}.
 */
async function loadSchemaListDB() {
  let result;
  let err = '';
  await require('dotenv').config({path: '../.env'});
  try {
    // Connect to the MongoDB cluster
    mongoClient = await conn.connectToCluster();
    result = await mongoClient.db().collection('schemas').find().toArray()
    ;
    if (!result) {
      throw new Error(`Error loading schema`);
    }
  } catch (e) {
    // console.error(e);
    err = e.message;
  } finally {
    return {error: err, result: result};
  }
}

/**
 * SendSchemasToCheck - load schemas.
 * @response {object} - return object {error: err, result: result}.
 */
async function sendSchemasToCheck() {
  const port = (process.argv[2] || '8080');
  let count = 1;
  const arrSchemas = await loadSchemaListDB();
  for (let x = 0; x < arrSchemas.result.length; x++) {
    const item = arrSchemas.result[x];
    for (let i = 0; i < item.examples.length; i++) {
      const example = item.examples[i];
      const options = {
        method: 'POST',
        url: `http://localhost:${port}/api/payloads`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': '3161fd56-1869-42d5-b58a-6c217083c739',
        },
        data: {
          'oasUrl': item.openApiSpecPath,
          'payloadSourceId': '11111111',
          'payloadSourceName': 'Bank UK',
          'interactionId': '09be02f2-0a3f-11ee-be56-0242ac120002',
          'requestUrl': 'https://api.banco.com.br/open-banking/xxxx/v2/' + item.pathName,
          'requestPath': item.pathName,
          'requestOperation': item.operationName,
          'requestContentType': item.contentType,
          'responseCode': item.responseCode,
          'responsePayload': example,
          'tags': 'loadtest',
          'date': '2021-02-01',
        },
      };

      console.log(count++);
      try {
        await axios.request(options);
      } catch (err) {
        console.log(err.message);
      }
    }
  }
}

(async () => {
  await sendSchemasToCheck();
  console.log('Finished');
  await mongoClient.close();
})();

