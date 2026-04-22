import * as JobsService from './jobs.service.js';

export async function getJobs(req, res, next) {
  try {
    const result = await JobsService.getJobs(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getJobById(req, res, next) {
  try {
    const job = await JobsService.getJobById(req.params.id);
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
}

export async function createJob(req, res, next) {
  try {
    const job = await JobsService.createJob(req.body);
    res.status(201).json({ success: true, data: job });
  } catch (err) { next(err); }
}

export async function updateJob(req, res, next) {
  try {
    const job = await JobsService.updateJob(req.params.id, req.body);
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
}

export async function updateJobStatus(req, res, next) {
  try {
    const job = await JobsService.updateJobStatus(req.params.id, req.body.status);
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
}

export async function deleteJob(req, res, next) {
  try {
    await JobsService.deleteJob(req.params.id);
    res.json({ success: true, message: 'Job deleted' });
  } catch (err) { next(err); }
}

export async function reorderJobs(req, res, next) {
  try {
    await JobsService.reorderJobs(req.body.orderedIds);
    res.json({ success: true, message: 'Jobs reordered' });
  } catch (err) { next(err); }
}
