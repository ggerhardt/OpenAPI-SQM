const OpenAPIBackend = require('openapi-backend').default;
const Koa = require('koa');
const serve = require('koa-static');
const mount = require('koa-mount');
const path = require('path');
const cors = require('@koa/cors');
const {bodyParser} = require('@koa/bodyparser');
const routePayloads = require('./master_payloads_route.js');
const routeReports = require('./master_reports_route.js');
require('dotenv').config();
const fs = require('fs');
const {exit} = require('process');

(async () => {
  const pino = require('koa-pino-logger')({
    level: process.env.LOG_LEVEL??'info',
  });

  const app = new Koa();
  app.use(pino);
  let obj = Object;
  try {
    const oasText = fs.readFileSync('./public/openapi.json', 'utf8');
    obj = JSON.parse(oasText);
  } catch (err) {
    pino.logger.error(err);
    exit;
  }

  const api = new OpenAPIBackend({
    definition: obj,
    apiRoot: '/api',
    strict: false,
    handlers: {
      addPayload: routePayloads.addPayload,
      getPayloads: routePayloads.getPayloads,
      getPayload: routePayloads.getPayload,
      deletePayload: routePayloads.deletePayload,
      deletePayloads: routePayloads.deletePayloads,

      getReports: routeReports.getReports,
      addReports: routeReports.addReports,
      getReport: routeReports.getReport,
      deleteReport: routeReports.deleteReport,
      deleteReports: routeReports.deleteReports,

      unauthorizedHandler: routePayloads.unauthorizedHandler,
      validationFail: routePayloads.validationFail,
      notFound: routePayloads.notFound,
      //  , postResponseHandler: (c, ctx) => {
      //   const valid = c.api.validateResponse(ctx.body,_
      //   c.operation, ctx.status);
      //   if (valid.errors) {
      //     // response validation failed
      //     pino.logger.debug("--------------------------")
      //     pino.logger.debug(valid.errors)
      //     pino.logger.debug("--------------------------")
      //     ctx.status = 502
      //     ctx.body = { err: valid.errors }
      //     return;
      //   }
      //   return;
      // }
    },
  },
  );

  api.registerSecurityHandler('APIKeyAuth', (c) => {
    const authorized =
      c.request.headers['x-api-key'] === process.env.APIKEY;
    // truthy return values are interpreted as auth success
    // you can also add any auth information to the return value
    return authorized;
  });

  // initalize the backend
  api.init();

  const corsOptions = {
    origin: '*', // allow access from example.com
    optionsSuccessStatus: 200, // some legacy browsers (IE11) choke on 204
  };
  app.use(cors(corsOptions));
  app.use(bodyParser({
    jsonLimit: process.env.PAYLOAD_MAX_SIZE??'1mb',
    onError: function(err, ctx) {
      ctx.throw(422, err.message);
    },
  }));
  app.use(mount('/docs', serve(path.join(__dirname, '../public'))));

  const port = process.env.NODE_DOCKER_PORT || 8080;

  app.use((ctx) => api.handleRequest(ctx.request, ctx));
  const server = app.listen(port, () => pino.logger.info('api listening at http://localhost:' + port));
  server.setTimeout(120000);
})();
