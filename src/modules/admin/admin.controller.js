import * as AdminService from './admin.service.js';

export async function getDashboardStats(req, res, next) {
  try {
    const stats = await AdminService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
}

export async function getPipelineReport(req, res, next) {
  try {
    const result = await AdminService.getPipelineReport(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

