const throng = require('throng');
require('dotenv').config();
const cpuCount = require('os').cpus().length;

const slaves = process.env.WEB_CONCURRENCY ?? cpuCount;
throng({master, worker, count: slaves});

/**
 * Start the 'master' web process. It's called by throng.
 */
async function master() {
  console.log('Started master');

  await import('./processes/master.js');

  process.on('beforeExit', () => {
    console.log('Master cleanup.');
  });
}

/**
 * Start the 'worker' processe. It's called by throng.
 * @param {string} id - Id of the worker.
 * @param {function} disconnect - callback for the disconnect function.
 */
async function worker(id, disconnect) {
  let exited = false;

  console.log(`Started worker ${id}`);
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await import('./processes/worker.js');

  /**
   * Function called to shutdown the worker.
   */
  async function shutdown() {
    if (exited) return;
    exited = true;
    console.log(`Worker ${id} cleanup done.`);
    disconnect();
  }
}
