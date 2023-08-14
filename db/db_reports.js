/* eslint-disable max-len */
const conn = require('../helper/connectUtils.js');
let mongoClient;

/**
 * Get report info.
 * @param {string} reportId - Report Id
 * @return {object} a return object: {error: err or null, result: object}
 */
async function getReportDB(reportId) {
  let result;
  let err = '';
  try {
    mongoClient = await conn.connectToCluster();
    result = await mongoClient.db().collection('reports').findOne({'_id': reportId});
    if (!result) {
      throw new Error(`Object ReportId '${reportId}' not found`);
    }
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result};
  }
}

/**
* Get reports list.
 * @param {string} aggregatorField - filter by aggregator field. Eg. oasUrl
 * @param {string} aggregatorFieldValue - filter by aggregator field value. Eg. https://x.y.z/openapi.json
 * @param {string} period - filter by period of reference
 * @param {string} status - filter by status
 * @param {string} pageNumber - inform the page number
 * @param {string} recordsPerPage - number of records
 * @return {object} a return object: {error: err or null, result: [object]}
 */
async function getReportsDB(aggregatorField, aggregatorFieldValue, period, status, pageNumber, recordsPerPage) {
  let result2;
  let err = '';
  const conditions = [];
  if (aggregatorField) {
    conditions.push({'groupedByField': aggregatorField});
  }
  if (aggregatorFieldValue) {
    conditions.push({'groupedByFieldValue': aggregatorFieldValue});
  }
  if (status) {
    conditions.push({'status': status});
  }
  if (period) {
    conditions.push({'period': period});
  }

  const objCondition = conditions.length > 0 ? {'$and': conditions} : undefined;
  const pageNumberInt = (pageNumber) ? parseInt(pageNumber) : 1;
  const recordsPerPageInt = (recordsPerPage) ? parseInt(recordsPerPage) : 50;
  try {
    // Connect to the MongoDB cluster
    mongoClient = await conn.connectToCluster();
    // Make the appropriate DB calls
    const cursor = await mongoClient.db().collection('reports').find(objCondition).project({_id: 1, groupedByField: 1, groupedByValue: 1, status: 1, period: 1}).skip(pageNumberInt > 0 ? ((pageNumberInt - 1) * recordsPerPageInt) : 0).limit(recordsPerPageInt);
    result2 = await cursor.toArray();
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result2};
  }
}

/**
 * Add reports.
 * @param {object} report - report object to be added to db
 * @return {object} a return object: {error: err or null, result: object}
 */
async function addReportsDB(report) {
  let obj;
  let result;
  let err = '';
  try {
    mongoClient = await conn.connectToCluster();
    obj = report;
    obj.status ='NOT_STARTED';
    result = await mongoClient.db().collection('reports').insertOne(obj, {returnNewDocument: true});
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result};
  }
}

/**
 * Update report.
 * @param {string} reportId - report id
 * @param {object} report - attributes to be updated
 * @return {object} a return object: {error: err or null, result: object}
 */
async function updateReportDB(reportId, report) {
  let result;
  let err = '';
  try {
    mongoClient = await conn.connectToCluster();
    if (!report) {
      report = {};
    }
    result = await mongoClient.db().collection('reports').updateOne({_id: reportId},
        [{$set: report}],
    );
    if (!result) {
      throw new Error(`Error patching report id '${reportId}'`);
    }
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result};
  }
}

/**
 * Delete report.
 * @param {string} reportId - report id
 * @return {object} a return object: {error: err or null, result: object}
 */
async function deleteReportDB(reportId) {
  let result;
  let result2;
  let err = '';
  try {
    mongoClient = await conn.connectToCluster();
    result = await mongoClient.db().collection('reports').findOne({_id: reportId});
    if (result) {
      result2 = await mongoClient.db().collection('reports').deleteOne({_id: reportId});
      if (!result2) {
        throw new Error(`Error deleting obj '${reportId}'`);
      }
    } else {
      throw new Error(`Error looking for obj '${reportId}' to delete`);
    }
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result2};
  }
}

module.exports.addReportsDB = addReportsDB;
module.exports.getReportDB = getReportDB;
module.exports.getReportsDB = getReportsDB;
module.exports.updateReportDB = updateReportDB;
module.exports.deleteReportDB = deleteReportDB;
