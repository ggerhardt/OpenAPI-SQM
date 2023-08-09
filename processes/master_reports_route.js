const payloadsDb = require('../db/db_payloads.js');
const reportsDb = require('../db/db_reports.js');
const queue = require('./worker_reports_queue.js');

const addReports = async (c, ctx) => {
  if (ctx.request.body.filters?.startDate &&
      ctx.request.body.filters?.endDate) {
    if (ctx.request.body.filters?.startDate >
        ctx.request.body.filters?.endDate) {
      ctx.body = {err: [{message: 'endDate must be equal to or greater than startDate'}]};
      ctx.status = 400;
      return;
    }
  }
  const createReportsBy = ctx.request.body.createReportsBy;
  const getPaylDb = await payloadsDb.getPayloadsDB('FALSE', ctx.request.body.filters?.payloadSourceId, ctx.request.body.filters?.oasUrl, ctx.request.body.filters?.startDate, ctx.request.body.filters?.endDate, undefined, undefined, undefined, 1, 10000);
  if (getPaylDb.error != '') {
    ctx.body = {err: [{message: getPaylDb.error}]};
    ctx.status = 400;
    return;
  }
  if (getPaylDb.result.length == 0) {
    ctx.body = {err: [{message: 'No payloads found with this parameters'}]};
    ctx.status = 400;
    return;
  }
  const parmsList = getPaylDb.result.reduce((repParmsList, item) => {
    const foundObj = repParmsList.find((consolidatedItem) => {
      // time aggregator
      const aggTime = ctx.request.body.createDailyReports ? item.date : `${ctx.request.body.filters?.startDate ?? ''}:${ctx.request.body.filters?.endDate ?? ''}`;
      const aggFieldValue = item[createReportsBy];
      return consolidatedItem.period == aggTime &&
             consolidatedItem.aggFieldValue == aggFieldValue;
      // eslint-disable-next-line max-len
      // return ((consolidatedItem[ctx.request.body.groupedByField] == item[ctx.request.body.groupedByField]) && ((consolidatedItem.date == item.date) || (!ctx.request.body.createDailyReports)));
    });
    if (!foundObj) {
      const aggTime = ctx.request.body.createDailyReports ? item.date : `${ctx.request.body.filters?.startDate ?? ''}:${ctx.request.body.filters?.endDate ?? '' }`;
      const aggFieldValue = item[createReportsBy];

      repParmsList.push({aggfield: createReportsBy,
        aggFieldValue: aggFieldValue, period: aggTime});
      return repParmsList;
    } else {
      return repParmsList;
    }
  }, []);

  for (let i = 0; i < parmsList.length; i++) {
    const dtCreation = new Date();
    const addRepDb = await reportsDb.addReportsDB({createdDateTime: dtCreation,
      groupedByField: createReportsBy,
      groupedByValue: parmsList[i].aggFieldValue, period: parmsList[i].period});
    if (addRepDb.error) {
      parmsList[i].error = retdb.error;
    } else {
      parmsList[i].reportId = addRepDb.result.insertedId;
      queue.push({
        _id: parmsList[i].reportId,
        aggField: parmsList[i].aggField,
        aggFieldValue: parmsList[i].aggFieldValue,
        period: parmsList[i].period,
        ...ctx.request.body}); // add to the queue
    }
  }
  ctx.body = parmsList;
  ctx.status = 200;
};

const getReports = async (c, ctx) => {
  const retdb = await reportsDb.getReportsDB(c.request.query['aggregator_field'], c.request.query['aggregator_field_value'], c.request.query['period'], c.request.query['status'], c.request.query['page_number'], c.request.query['records_per_page']);
  if (retdb.error != '') {
    ctx.body = {err: [{message: retdb.error}]};
    ctx.status = 400;
  } else {
    ctx.body = retdb.result;
    ctx.status = 200;
  }
};

const getReport = async (c, ctx) => {
  const retdb = await reportsDb.getReportDB(c.request.params['report_id']);
  if (retdb.error != '') {
    ctx.body = {err: [{message: retdb.error}]};
    ctx.status = 400;
  } else {
    ctx.body = retdb.result;
    ctx.status = 200;
  }
};

const deleteReport = async (c, ctx) => {
  const retdb = await reportsDb.deleteReportDB(c.request.params['report_id']);
  if (retdb.error != '') {
    ctx.body = {err: [{message: retdb.error}]};
    ctx.status = 400;
  } else {
    ctx.status = 204;
  }
};

module.exports.addReports = addReports;
module.exports.getReports = getReports;
module.exports.getReport = getReport;
module.exports.deleteReport = deleteReport;
