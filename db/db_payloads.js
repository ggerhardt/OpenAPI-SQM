/* eslint-disable max-len */
const conn = require('../helper/connectUtils.js');
let mongoClient;

/**
 * Get payload object.
 * @param {string} payloadId - Payload Id
 * @return {object} a return object: {error: err or null, result: object}
 */
async function getPayloadDB(payloadId) {
  let result;
  let err = '';
  try {
    mongoClient = await conn.connectToCluster();
    result = await mongoClient.db().collection('payloads').findOne({'_id': payloadId});
    if (!result) {
      throw new Error(`Object PayloadId '${payloadId}' not found`);
    }
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result};
  }
}

/**
* Get payloads list.
 * @param {string} detailedInfo - show detailed info? TRUE/FALSE
 * @param {string} payloadSourceId - filter by payloadSourceId
 * @param {string} oasUrl - filter by oasUrl
 * @param {string} startDate - filter by startDate
 * @param {string} endDate - filter by endDate
 * @param {string} interactionId - filter by interactionId
 * @param {string} status - filter by status
 * @param {string} tags - filter by tags
 * @param {string} pageNumber - inform the page number
 * @param {string} recordsPerPage - number of records
 * @return {object} a return object: {error: err or null, result: [object]}
 */
async function getPayloadsDB(detailedInfo, payloadSourceId, oasUrl, startDate, endDate, interactionId, status, tags, pageNumber, recordsPerPage) {
  let result2;
  let err = '';
  const conditions = [];
  if (payloadSourceId) {
    conditions.push({'payloadSourceId': `${payloadSourceId}`});
  }
  if (oasUrl) {
    conditions.push({'oasUrl': `${oasUrl}`});
  }
  if (status) {
    conditions.push({'status': `${status}`});
  }
  if (interactionId) {
    conditions.push({'interactionId': `${interactionId}`});
  }
  if (tags) {
    conditions.push({'tags': {$all: `${tags}`.split(',')}});
  }
  if (startDate && startDate !='') {
    conditions.push({'date': {$gte: `${startDate}`}});
  }
  if (endDate && endDate != '') {
    conditions.push({'date': {$lte: `${endDate}`}});
  }

  const objCondition = conditions.length > 0 ? {'$and': conditions} : undefined;
  const pageNumberInt = (pageNumber) ? parseInt(pageNumber) : 1;
  const recordsPerPageInt = (recordsPerPage) ? parseInt(recordsPerPage) : 50;
  try {
    mongoClient = await conn.connectToCluster();
    let cursor;
    if (detailedInfo == 'FALSE') {
      cursor = await mongoClient.db().collection('payloads').find(objCondition).project({_id: 1, oasUrl: 1, payloadSourceId: 1, interactionId: 1, requestUrl: 1, requestPath: 1, requestOperation: 1, requestContentType: 1, responseCode: 1, status: 1, statusDetail: 1, tags: 1, date: 1}).skip(pageNumberInt > 0 ? ((pageNumberInt - 1) * recordsPerPageInt) : 0).limit(recordsPerPageInt);
    } else {
      cursor = await mongoClient.db().collection('payloads').find(objCondition).skip(pageNumberInt > 0 ? ((pageNumberInt - 1) * recordsPerPageInt) : 0).limit(recordsPerPageInt);
    }
    result2 = await cursor.toArray();
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result2};
  }
}

/**
 * Add payload.
 * @param {object} payload - payload object to be added
 * @return {object} a return object: {error: err or null, result: object}
 */
async function addPayloadDB(payload) {
  let obj;
  let result;
  let err = '';
  try {
    mongoClient = await conn.connectToCluster();
    obj = payload;
    obj.status = 'NOT_STARTED';
    if ((!obj.requestUrl) && (!obj.requestPath)) {
      throw new Error('At least one of the following attributes must be provided: \'requestUrl\' or \'requestPath\'.');
    }
    result = await mongoClient.db().collection('payloads').insertOne(obj, {returnNewDocument: true});
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result};
  }
}

/**
 * Update payload.
 * @param {string} payloadId - payload id
 * @param {object} payload - attributes to be updated
 * @return {object} a return object: {error: err or null, result: object}
 */
async function updatePayloadDB(payloadId, payload) {
  let result;
  let err = '';
  try {
    mongoClient = await conn.connectToCluster();
    if (!payload) {
      payload = {};
    }
    payload.testDate = new Date();
    result = await mongoClient.db().collection('payloads').updateOne({_id: payloadId},
        [{$set: payload}],
    );
    if (!result) {
      throw new Error(`Error patching payload id '${payloadId}'`);
    }
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result};
  }
}
/**
 * Delete payload.
 * @param {string} payloadId - payload id
 * @return {object} a return object: {error: err or null, result: object}
 */
async function deletePayloadDB(payloadId) {
  let result;
  let result2;
  let err = '';
  try {
    mongoClient = await conn.connectToCluster();
    result = await mongoClient.db().collection('payloads').findOne({_id: payloadId});
    if (result) {
      result2 = await mongoClient.db().collection('payloads').deleteOne({_id: payloadId});
      if (!result2) {
        throw new Error(`Error deleting obj '${payloadId}'`);
      }
    } else {
      throw new Error(`Error looking for obj '${payloadId}' to delete`);
    }
  } catch (e) {
    err = e.message;
  } finally {
    return {error: err, result: result2};
  }
}

module.exports.addPayloadDB = addPayloadDB;
module.exports.getPayloadDB = getPayloadDB;
module.exports.getPayloadsDB = getPayloadsDB;
module.exports.updatePayloadDB = updatePayloadDB;
module.exports.deletePayloadDB = deletePayloadDB;
