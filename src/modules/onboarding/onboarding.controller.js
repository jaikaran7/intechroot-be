import * as OnboardingService from './onboarding.service.js';

export async function getOnboardingState(req, res, next) {
  try {
    const data = await OnboardingService.getOnboardingState(req.params.applicationId, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function submitProfile(req, res, next) {
  try {
    const data = await OnboardingService.submitProfileStep(req.params.applicationId, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function patchProfile(req, res, next) {
  try {
    const data = await OnboardingService.patchApplicantProfile(req.params.applicationId, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function submitDocuments(req, res, next) {
  try {
    const data = await OnboardingService.submitDocumentsStep(req.params.applicationId, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function acknowledgeBgv(req, res, next) {
  try {
    const data = await OnboardingService.acknowledgeBgv(req.params.applicationId, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function finalSubmit(req, res, next) {
  try {
    const data = await OnboardingService.finalSubmit(req.params.applicationId, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function adminEnableOnboarding(req, res, next) {
  try {
    const data = await OnboardingService.adminEnableOnboarding(req.params.applicationId, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function adminRequestDocument(req, res, next) {
  try {
    const data = await OnboardingService.adminRequestDocument(req.params.applicationId, req.body.name, req.user);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function adminDeleteDocumentRequest(req, res, next) {
  try {
    const data = await OnboardingService.adminDeleteDocumentRequest(
      req.params.applicationId,
      req.params.requestId,
      req.user,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function adminApproveProfile(req, res, next) {
  try {
    const data = await OnboardingService.adminApproveProfile(req.params.applicationId, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function adminApproveDocuments(req, res, next) {
  try {
    const data = await OnboardingService.adminApproveDocuments(req.params.applicationId, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function adminSetBgv(req, res, next) {
  try {
    const data = await OnboardingService.adminSetBgv(req.params.applicationId, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
