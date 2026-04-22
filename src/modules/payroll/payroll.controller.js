import * as PayrollService from './payroll.service.js';

export async function getAllPayslips(req, res, next) {
  try {
    const result = await PayrollService.getAllPayslips(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getEmployeePayslips(req, res, next) {
  try {
    const result = await PayrollService.getEmployeePayslips(req.params.employeeId, req.query, req.user);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function createPayslip(req, res, next) {
  try {
    const payslip = await PayrollService.createPayslip(req.body);
    res.status(201).json({ success: true, data: payslip });
  } catch (err) { next(err); }
}
