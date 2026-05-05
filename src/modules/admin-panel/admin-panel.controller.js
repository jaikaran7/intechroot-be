import * as AdminPanelService from './admin-panel.service.js';

export async function listAdmins(req, res, next) {
  try {
    const result = await AdminPanelService.listAdmins(req.query, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAdmin(req, res, next) {
  try {
    const data = await AdminPanelService.getAdmin(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createAdmin(req, res, next) {
  try {
    const data = await AdminPanelService.createAdmin(req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateAdmin(req, res, next) {
  try {
    const data = await AdminPanelService.updateAdmin(req.params.id, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdmin(req, res, next) {
  try {
    const data = await AdminPanelService.deleteAdmin(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listEmployees(req, res, next) {
  try {
    const result = await AdminPanelService.listEmployees(req.query, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAdminAssignments(req, res, next) {
  try {
    const data = await AdminPanelService.getAdminAssignments(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function setAdminAssignments(req, res, next) {
  try {
    const data = await AdminPanelService.setAdminAssignments(req.params.id, req.body.employeeIds, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(req, res, next) {
  try {
    const data = await AdminPanelService.getDashboard(req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTimesheets(req, res, next) {
  try {
    const result = await AdminPanelService.getTimesheets(req.query, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function approveTimesheet(req, res, next) {
  try {
    const timesheet = await AdminPanelService.approveTimesheet(req.params.id, req.user);
    res.json({ success: true, data: timesheet });
  } catch (err) {
    next(err);
  }
}

export async function rejectTimesheet(req, res, next) {
  try {
    const timesheet = await AdminPanelService.rejectTimesheet(req.params.id, req.body.rejectionNote, req.user);
    res.json({ success: true, data: timesheet });
  } catch (err) {
    next(err);
  }
}
