import * as TimesheetsService from './timesheets.service.js';

export async function getAllTimesheets(req, res, next) {
  try {
    const result = await TimesheetsService.getAllTimesheets(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getEmployeeTimesheets(req, res, next) {
  try {
    const employeeId = req.params.employeeId || req.params.id;
    const result = await TimesheetsService.getEmployeeTimesheets(employeeId, req.query, req.user);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function saveTimesheetDraft(req, res, next) {
  try {
    const employeeId = req.params.employeeId || req.params.id;
    const ts = await TimesheetsService.saveTimesheetDraft(employeeId, req.body, req.user);
    res.status(201).json({ success: true, data: ts });
  } catch (err) { next(err); }
}

export async function submitTimesheetForApproval(req, res, next) {
  try {
    const ts = await TimesheetsService.submitTimesheetForApproval(req.params.id, req.user);
    res.json({ success: true, data: ts });
  } catch (err) { next(err); }
}

export async function approveTimesheet(req, res, next) {
  try {
    const ts = await TimesheetsService.approveTimesheet(req.params.id);
    res.json({ success: true, data: ts });
  } catch (err) { next(err); }
}

export async function rejectTimesheet(req, res, next) {
  try {
    const ts = await TimesheetsService.rejectTimesheet(req.params.id, req.body.rejectionNote);
    res.json({ success: true, data: ts });
  } catch (err) { next(err); }
}
