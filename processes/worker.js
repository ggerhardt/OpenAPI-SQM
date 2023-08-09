const queuePayloads = require('./worker_payloads_queue.js');
const queueReports = require('./worker_reports_queue.js');
require('dotenv').config();


queuePayloads.startListening();
queueReports.startListening();
