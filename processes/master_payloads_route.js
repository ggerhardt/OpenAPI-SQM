const payloadsDb = require('../db/db_payloads.js');
const queue = require('./worker_payloads_queue.js');

const addPayload = async (c, ctx) => {
  let responsePayload;
  const sync = c.request.query['sync']=='true';
  try {
    // eslint-disable-next-line max-len
    responsePayload = JSON.parse(JSON.stringify(ctx.request.body.responsePayload));
    if (typeof(responsePayload) == 'string') {
      throw new Error('Payload should be a object or an array');
    }
  } catch (err) {
    ctx.body = {err: [{message: '[response_payload] ' + err.message}]};
    ctx.status = 400;
    return;
  }
  // Only keeps responsePayload attr if KEEP_PAYLOAD_CONTENT==TRUE
  if ((process.env.KEEP_PAYLOAD_CONTENT ?? 'FALSE') != 'TRUE') {
    delete ctx.request.body.responsePayload;
  }
  const retdb = await payloadsDb.addPayloadDB(ctx.request.body);
  if (retdb.error) {
    ctx.body = {err: [{message: retdb.error}]};
    ctx.status = 400;
  } else {
    ctx.request.body.responsePayload = responsePayload;
    queue.push({'_id': retdb.result.insertedId, ...ctx.request.body});
    if (!sync) {
      ctx.body = retdb.result;
      ctx.status = 200;
      return;
    } else {
      
      let availableIterations = 30; //
      while (availableIterations > 0) {
        await waitOneSecond();
        const retdbloop = await payloadsDb.getPayloadDB(retdb.result.insertedId);
        if (retdbloop.error != '') {
          ctx.body = {err: [{message: retdbloop.error}]};
          ctx.status = 400;
          return;
        } else {
          if (retdbloop.result.status != "NOT_STARTED" && retdbloop.result.status != "STARTED"){
            ctx.body = retdbloop.result;
            ctx.status = 200;
            return
          }
        }
      }
      //could't complete in 30 cycles
      retdb.result.sync = false;
      //ctx.request.body.responsePayload = responsePayload;
      ctx.body = retdb.result;
      ctx.status = 200;
      return;
    }
  }
};

const getPayload = async (c, ctx) => {
  const retdb = await payloadsDb.getPayloadDB(c.request.params['payload_id']);
  if (retdb.error != '') {
    ctx.body = {err: [{message: retdb.error}]};
    ctx.status = 400;
  } else {
    ctx.body = retdb.result;
    ctx.status = 200;
  }
};

const getPayloads = async (c, ctx) => {
  const retdb = await payloadsDb.getPayloadsDB(c.request.query['detailed_info'], c.request.query['payload_source_id'], undefined, c.request.query['date'], c.request.query['date'], c.request.query['interaction_id'], c.request.query['status'], c.request.query['tags'], c.request.query['page_number'], c.request.query['records_per_page']);
  if (retdb.error != '') {
    ctx.body = {err: [{message: retdb.error}]};
    ctx.status = 400;
  } else {
    ctx.body = retdb.result;
    ctx.status = 200;
  }
};

const deletePayload = async (c, ctx) => {
  const retdb = await payloadsDb.deletePayloadDB(c.request.params['payload_id']);
  if (retdb.error != '') {
    ctx.body = {err: [{message: retdb.error}]};
    ctx.status = 400;
  } else {
    ctx.status = 204;
  }
};

const deletePayloads = async (c, ctx) => {
  const retdb = await payloadsDb.deletePayloadsDB(c.request.query['tags'], c.request.query['date']);
  if (retdb.error != '') {
    ctx.body = {err: [{message: retdb.error}]};
    ctx.status = 400;
  } else {
    ctx.status = 204;
  }
};

async function waitOneSecond() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, 1000); // 1000 milissegundos = 1 second
  });
}

const unauthorizedHandler = async (c, ctx) => {
  ctx.body = {err: [{message: 'unauthorized'}]};
  ctx.status = 401;
};

const validationFail = async (c, ctx) => {
  ctx.body = {err: c.validation.errors};
  ctx.status = 400;
};

const notFound = async (c, ctx) => {
  ctx.response;
  ctx.body = {err: [{message: `not found: ${ctx.req.url}`}]};
  ctx.status = 404;
};

module.exports.getPayload = getPayload;
module.exports.getPayloads = getPayloads;
module.exports.addPayload = addPayload;
module.exports.deletePayloads = deletePayloads;
module.exports.deletePayload = deletePayload;
module.exports.unauthorizedHandler = unauthorizedHandler;
module.exports.validationFail = validationFail;
module.exports.notFound = notFound;
