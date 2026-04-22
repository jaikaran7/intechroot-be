import * as AppService from './applications.service.js';
import { createApplicationSchema } from './applications.schema.js';
import { ValidationError } from '../../utils/errors.js';

export async function getApplications(req, res, next) {
  try {
    const result = await AppService.getApplications(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getApplicationStats(req, res, next) {
  try {
    const data = await AppService.getApplicationStats(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getApplicationById(req, res, next) {
  try {
    const app = await AppService.getApplicationById(req.params.id, req.user);
    res.json({ success: true, data: app });
  } catch (err) { next(err); }
}

export async function getApplicationByEmail(req, res, next) {
  try {
    const app = await AppService.getApplicationByEmail(req.params.email);
    res.json({ success: true, data: app });
  } catch (err) { next(err); }
}

export async function createApplication(req, res, next) {
  try {
    let body = { ...req.body };
    if (typeof body.skills === 'string') {
      try {
        body.skills = JSON.parse(body.skills || '[]');
      } catch {
        body.skills = [];
      }
    }
    const parsed = createApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return next(new ValidationError('Validation failed', parsed.error.flatten()));
    }
    const app = await AppService.createApplication(parsed.data, req.file || null);
    res.status(201).json({ success: true, data: app });
  } catch (err) { next(err); }
}

export async function advanceStage(req, res, next) {
  try {
    const app = await AppService.advanceStage(req.params.id, req.user, req.body.note);
    res.json({ success: true, data: app });
  } catch (err) { next(err); }
}

export async function hireApplicant(req, res, next) {
  try {
    const result = await AppService.hireApplicant(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function approvePortalAccess(req, res, next) {
  try {
    const data = await AppService.approvePortalAccess(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function rejectApplication(req, res, next) {
  try {
    const data = await AppService.rejectApplication(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createInterview(req, res, next) {
  try {
    const interview = await AppService.createInterview(req.params.id, req.body);
    res.status(201).json({ success: true, data: interview });
  } catch (err) { next(err); }
}

export async function updateInterview(req, res, next) {
  try {
    const interview = await AppService.updateInterview(req.params.id, req.params.iid, req.body);
    res.json({ success: true, data: interview });
  } catch (err) { next(err); }
}

export async function createMessage(req, res, next) {
  try {
    const message = await AppService.createMessage(
      req.params.id,
      req.body.text,
      req.user?.userId || 'admin'
    );
    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
}
