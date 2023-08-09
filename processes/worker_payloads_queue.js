const conn = require('../helper/connectUtils.js');
const payloadDb = require('../db/db_payloads.js');
const schUtils = require('../helper/schemaUtils.js');
const {Queue} = require('../helper/queue_mongodb.js');
const queueTest = new Queue('test');
const logger = require('pino')({
  level: process.env.LOG_LEVEL??'info',
});
(async () => {
  await conn.connectToCluster();
})();

/**
 * startListening - Start checking for new payloads no the queue.
 */
function startListening() {
  setInterval(async function() {
    const rec = await queueTest.receive();
    if (rec != null) {
      try {
        await processQueue(rec.data);
      } catch (err) {
        logger.error(`Error checking item: ${err.message}`);
      }
    }
  }, parseInt(process.env.CHECK_QUEUE_INTERVAL) || 1000,
  );
}

/**
 * processQueue - Extract and process one item from the queue.
 * @param {object} job - data to be analysed.
 */
async function processQueue(job) {
  const NS_PER_SEC = 1e9;
  const time = process.hrtime();

  try {
    const udpDB = await payloadDb.updatePayloadDB(job._id, {status: 'STARTED'});
    if (udpDB.error) {
      // eslint-disable-next-line max-len
      throw new Error(`Error updating payload '${job._id}' logs: ${udpDB.error}`);
    }
    const payload = job.responsePayload;
    const openApiSpecPath = job.oasUrl;
    const url = job.requestUrl;
    const pathName = job.requestPath;
    const operationName = job.requestOperation;
    const responseCode = job.responseCode;
    const contentType = job.requestContentType;

    // get schema
    let schInfo = undefined;
    try {
      if (pathName) {
        schInfo = await schUtils.getSchema(
            openApiSpecPath,
            pathName,
            operationName,
            responseCode,
            contentType);
      } else {
        schInfo = await schUtils.getSchemaUrl(
            openApiSpecPath,
            url,
            operationName,
            responseCode,
            contentType);
      }
      if (!schInfo) {
        throw new Error('Error getting schema');
      };
    } catch (err) {
      const updDb = await payloadDb.updatePayloadDB(job._id, {status: 'ERROR', statusDetail: err.message});
      if (updDb.error) {
        throw new Error(
            `Error updating payload '${job._id}' logs: ${udpDB.error}`);
      }
      return;
    }
    const oasInfo = {
      schemaId: schInfo.schemaId,
      oasApiName: schInfo.apiName,
      oasPath: schInfo.path,
      oasOperation: schInfo.operation,
      oasResponseCode: schInfo.response,
      oasContentType: schInfo.content,
    };
    const payloadEval = schUtils.validatePayload(schInfo.schemaId, payload);
    if (payloadEval.errorProcessingPayload) {
      const updDb = await payloadDb.updatePayloadDB(job._id, {status: 'ERROR', oasInfo: oasInfo, statusDetail: payloadEval.errorProcessingPayload});
      if (updDb.error) {
        throw new Error(
            `Error updating payload '${job._id}' logs: ${udpDB.error}`);
      }
      return;
    }

    const diff = process.hrtime(time);
    if (payloadEval.validSchema) {
      const udpDb = await payloadDb.updatePayloadDB(job._id, {status: 'FINISHED', oasInfo: oasInfo, testElapsedTime: diff[0] * NS_PER_SEC + diff[1]});
      if (udpDb.error) {
        throw new Error(
            `Error updating payload '${job._id}' logs: ${udpDB.error}`);
      }
    } else {
      const updPayload = {status: 'ERROR_SCHEMA', oasInfo: oasInfo, testElapsedTime: diff[0] * NS_PER_SEC + diff[1], log: payloadEval.errors};
      const udpDb = await payloadDb.updatePayloadDB(job._id, updPayload);
      if (udpDb.error) {
        throw new Error(
            // eslint-disable-next-line max-len
            `Error updating payload '${job._id}' to PROCESSED: logs: ${udpDB.error}`);
      }
    }
  } catch (err) {
    logger.error(err.message);
  }
}

/**
 * push - Inserts one item into the queue.
 * @param {object} data - data to be analysed.
 */
async function push(data) {
  await queueTest.send(data);
}

module.exports.push = push;
module.exports.startListening = startListening;
