/* eslint-disable max-len */
/** @module Queue-MongoDB */

// modules
require('dotenv').config();
const mongoC = require('./connectUtils');
const logger = require('pino')({
  level: process.env.LOG_LEVEL??'info',
});

// MongoDB database client
const dbName = process.env.DB_NAME || 'qdb';
const qCollectionName = process.env.QUEUE_DB_COLL || 'queue';

let dbClient;
let qCollection; // queue collection

/**
 * dbConnect - shared connection.
 * @response {object} - return mongoClient collection.
 */
async function dbConnect() {
  // collection available
  if (qCollection) return qCollection;

  // connect to database
  // await dbClient.connect();
  dbClient = await mongoC.connectToCluster();

  // collection defined?
  const
    db = dbClient.db(dbName);
  const colList = await db.listCollections({
    name: qCollectionName}, {nameOnly: true}).toArray();

  if (!colList.length) {
    // define collection schema
    const $jsonSchema = {
      bsonType: 'object',
      required: ['type', 'proc', 'data'],
      properties: {
        type: {bsonType: 'string', minLength: 1},
        proc: {bsonType: 'date'},
      },
    };
    await db.createCollection(qCollectionName, {validator: {$jsonSchema}});

    // define indexes
    await db.collection(qCollectionName).createIndexes([
      {key: {type: 1}},
      {key: {proc: 1}},
    ]);
  }

  // return queue collection
  qCollection = db.collection(qCollectionName);
  return qCollection;
}

/**
 * dbClose - close MongoDB database connection.
 * @response {object} - return mongoClient collection.
 */
async function dbClose() {
  if (qCollection) {
    await dbClient.close();
    qCollection = null;
  }
}

/**
 * Queue management class.
 */
class Queue {
  /**
   * Create a new queue handler.
   * @param {string} [type="DEFAULT"] - queue identifier (any number of separate queues can be defined)
   */
  constructor(type = 'DEFAULT') {
    this.type = type;
  }

  /**
   * Push data to the queue.
   * @param {any} data - data to queue
   * @param {number} [delayUntil] - optional future seconds or date to delay adding to the queue
   * @return {qItem} a queue item object: { _id, sent: {date}, data: {data} }, or null when a failure occurs
   */
  async send(data = null, delayUntil) {
    try {
      // calculate start date/time
      let proc = new Date();
      if (delayUntil instanceof Date) {
        proc = delayUntil;
      } else if (!isNaN(delayUntil)) {
        proc = new Date(+proc + delayUntil * 1000);
      }

      // add item to queue
      const
        q = await dbConnect();
      const ins = await q.insertOne({
        type: this.type, proc, data,
      });

      // return qItem //ins.insertedCount &&
      return ins && ins.insertedId ? {_id: ins.insertedId, data} : null; // sent: ins.insertedId.getTimestamp(),
    } catch (err) {
      logger.error(`Queue.send error:\n${err}`);
      return null;
    }
  }


  /**
   * Retrieve and remove next item from the queue.
   * @return {qItem} a queue item object: { _id, sent: {date}, data: {data} }, or null when no items are available
   */
  async receive() {
    try {
      // find and delete next item on queue
      const
        now = new Date();
      const q = await dbConnect();
      const rec = await q.findOneAndDelete(
          {
            type: this.type,
            proc: {$lt: now},
          },
          {
            sort: {proc: 1},
          },
      );

      const v = rec && rec.value;

      // return qItem
      return v ? {_id: v._id, data: v.data} : null;// , sent: v._id.getTimestamp()
    } catch (err) {
      logger.error(`Queue.receive error:\n${err}`);
      return null;
    }
  }


  /**
   * Remove a queued item
   * @param {qItem} qItem - remove a queue item (returned by send() or receive())
   * @return {number} the number of deleted items (normally 1)
   */
  async remove(qItem) {
    // no item to remove
    if (!qItem || !qItem._id) return null;

    try {
      const
        q = await dbConnect();
      const del = await q.deleteOne({_id: qItem._id});

      return del.deletedCount;
    } catch (err) {
      logger.error(`Queue.remove error:\n${err}`);
      return null;
    }
  }


  /**
   * Removes all queued items, including future ones.
   * @return {number} the number of deleted items
   */
  async purge() {
    try {
      const
        q = await dbConnect();
      const del = await q.deleteMany({type: this.type});

      return del.deletedCount;
    } catch (err) {
      logger.error(`Queue.purge error:\n${err}`);
      return null;
    }
  }


  /**
   * Count of all queued items.
   * @return {number} items in the queue
   */
  async count() {
    try {
      const q = await dbConnect();
      return await q.countDocuments({type: this.type});
    } catch (err) {
      logger.error(`Queue.count error:\n${err}`);
      return null;
    }
  }

  /**
   * Close queue connection.
   */
  async close() {
    try {
      await dbClose();
    } catch (err) {
      logger.error(`Queue.close error:\n${err}`);
      return null;
    }
  }
}

exports.Queue = Queue;
