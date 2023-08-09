const {MongoClient} = require('mongodb');
const {v4: uuidv4} = require('uuid');
const logger = require('pino')({
  level: process.env.LOG_LEVEL??'info',
});
let mongoClient;

/**
 * connectToCluster - Connects to mongoDb cluster.
 * @response {object} - return mongoClient object.
 */
async function connectToCluster() {
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(process.env.DB_URL
          , {pkFactory: {createPk: () => uuidv4()}},
      );
      logger.debug('Connecting to MongoDB ...');
      await mongoClient.connect();
      logger.debug('Successfully connected to MongoDB!');
    }
    return mongoClient;
  } catch (error) {
    logger.error('Connection to MongoDB failed!', error);
    process.exit();
  }
}

module.exports.connectToCluster = connectToCluster;
