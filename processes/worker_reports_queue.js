const conn = require('../helper/connectUtils.js');
const reportDb = require('../db/db_reports.js');
const payloadDb = require('../db/db_payloads.js');
const {Queue} = require('../helper/queue_mongodb.js');
const queueReport = new Queue('report');
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
    const rec = await queueReport.receive();
    if (rec != null) {
      try {
        await processReports(rec.data);
      } catch (err) {
        logger.error(`Error checking item: ${err.message}`);
      }
    }
  }, parseInt(process.env.CHECK_QUEUE_INTERVAL) || 1000,
  );
}

/**
 * processReports - Extract and process one item from the queue.
 * @param {object} job - data to be analysed.
 */
async function processReports(job) {
  try {
    const updDb = await reportDb.updateReportDB(job._id, {status: 'STARTED'});
    if (updDb.error) {
      logger.error(
          `Error updating report '${job._id}' logs: ${updDb.error}`);
      throw new Error(
          `Error updating report '${job._id}' logs: ${updDb.error}`);
    }
    const vPeriod = job.period.split(':');
    const showOrigin = job.showErrorSource??false;

    const getPaylDb = await payloadDb.getPayloadsDB('TRUE', (job.aggField == 'payloadSourceId') ? job.aggFieldValue : undefined, (job.aggField == 'oasUrl') ? job.aggFieldValue : undefined, vPeriod[0], (vPeriod.length>1)?vPeriod[1]:vPeriod[0], undefined, undefined, undefined, 1, 10000);
    if (getPaylDb.error) {
      logger.error(
          `Error reading payload '${job._id}' logs: ${getPaylDb.error}`);
      throw new Error(
          `Error reading payload '${job._id}' logs: ${getPaylDb.error}`);
    }
    const payloadsArray = getPaylDb.result;
    if (payloadsArray.length == 0) {
      logger.error(`No payloads selected '${job._id}'`);
      throw new Error(`Error reading payload '${job._id}'`);
    }

    const consolidatedList = payloadsArray.reduce((consolid, item) => {
      // eslint-disable-next-line max-len
      const key = `${item.oasUrl} ${item.oasInfo.oasPath} ${item.oasInfo.oasOperation}`+
          `${item.oasInfo.oasContentType} ${item.oasInfo.oasResponseCode}`;
      let foundObj = consolid.find((consolidItem) => {
        return consolidItem.key == key;
      });
      if (!foundObj) {
        foundObj = {
          key: key,
          oasUrl: item.oasUrl,
          requestPath: item.oasInfo.oasPath,
          requestOperation: item.oasInfo.oasOperation,
          responseContentType: item.oasInfo.oasContentType,
          responseCode: item.oasInfo.oasResponseCode,
          finishedOk: (item.status == 'FINISHED') ? 1 : 0,
          finishedErrorSchema: (item.status == 'ERROR_SCHEMA') ? 1 : 0,
          finishedErrorOther: (item.status == 'ERROR') ? 1 : 0,
          notStarted: (item.status == 'NOT_STARTED') ? 1 : 0,
          running: (item.status == 'STARTED') ? 1 : 0,
          errors: [],
        };
        consolid.push(foundObj);
      } else {
        foundObj.finishedOk = foundObj.finishedOk + ((item.status == 'FINISHED') ? 1 : 0);
        foundObj.finishedErrorSchema = foundObj.finishedErrorSchema + ((item.status == 'ERROR_SCHEMA') ? 1 : 0);
        foundObj.finishedErrorOther = foundObj.finishedErrorOther + ((item.status == 'ERROR') ? 1 : 0);
        foundObj.notStarted = foundObj.notStarted + ((item.status == 'NOT_STARTED') ? 1 : 0);
        foundObj.running = foundObj.running + ((item.status == 'STARTED') ? 1 : 0);
      }
      if (item.log) {
        foundObj.errors = item.log.reduce((listaCons, itemLog) => {
          return addErrors(listaCons, itemLog, (showOrigin)?item.payloadSourceId:'', (showOrigin)?item._id:'');
        }, foundObj.errors);
      }
      return consolid;
    }, []);
    const repUpdate = {status: 'FINISHED', consolidatedList: consolidatedList};
    const resp3 = await reportDb.updateReportDB(job._id, repUpdate);
    if (resp3.error) {
      logger.error(`Error updating payload '${job._id}' logs: ${resp3.error}`);
    };
  } catch (err) {
    const resp4 = await reportDb.updateReportDB(job._id, {status: 'ERROR', statusDetail: err.message});
    if (resp4.error) {
      logger.error(`Error updating payload '${job._id}' logs: ${resp4.error}`);
    };
  }
}

/**
 * push - Inserts one item into the queue.
 * @param {object} data - data to be analysed.
 */
async function push(data) {
  await queueReport.send(data);
}

/**
 * addErrors - process one error and update the aggregated list.
 * @param {object} consolidatedList - aggregated list of errors.
 * @param {object} item - error to be consolidated.
 * @param {string} sourceId - source identification.
 * @param {string} payloadId - payload with error.
 * @return {object} - updated consolidatedList
 */
function addErrors(consolidatedList, item, sourceId, payloadId) {
  const errorMessage = `${item.genInstancePath} ${item.message}`;
  // eslint-disable-next-line max-len
  const errorExample = `${item.instancePathExample}: ${item.instanceValueExample}`;
  const errorCount = item.count;
  const foundObj = consolidatedList.find((consolidatedItem) => {
    return consolidatedItem.errorMessage == errorMessage;
  });
  if (foundObj) {
    foundObj.totalErrors += errorCount;
    foundObj.totalRequests += 1;
    if (sourceId) {
      foundObj.payloads.push({id: payloadId, payloadSourceId: sourceId});
    }
    // 10% is the chance of changing the selected error example
    if (Math.random() <= 0.1) {
      foundObj.errorExample = errorExample;
    }
  } else {
    const errorObj = {
      errorMessage: errorMessage,
      errorExample: errorExample,
      totalErrors: errorCount,
      totalRequests: 1,
    };
    if (sourceId) {
      errorObj.payloads= [{id: payloadId, payloadSourceId: sourceId}];
    }
    consolidatedList.push(errorObj);
  }
  return consolidatedList;
}

module.exports.push = push;
module.exports.startListening = startListening;
