import { ForbiddenError } from '../../utils/errors.js';
import * as EmployeesService from './employees.service.js';

export async function addExtraDocumentRequest(req, res, next) {
  try {
    const { id } = req.params;
    if (req.user?.role === 'employee' && req.user.employeeId !== id) {
      throw new ForbiddenError('You can only add documents for your own profile');
    }
    const data = await EmployeesService.addEmployeeExtraDocumentRequest(id, req.body.name, req.user);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getEmployees(req, res, next) {
  try {
    const result = await EmployeesService.getEmployees(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getEmployeeById(req, res, next) {
  try {
    const employee = await EmployeesService.getEmployeeById(req.params.id, req.user);
    res.json({ success: true, data: employee });
  } catch (err) { next(err); }
}

export async function updateEmployee(req, res, next) {
  try {
    const { id } = req.params;
    if (req.user?.role === 'employee' && req.user.employeeId !== id) {
      throw new ForbiddenError('You can only update your own employee profile');
    }
    const employee = await EmployeesService.updateEmployee(id, req.body, req.user);
    res.json({ success: true, data: employee });
  } catch (err) { next(err); }
}

export async function updateEmployeeStatus(req, res, next) {
  try {
    const employee = await EmployeesService.updateEmployeeStatus(req.params.id, req.body.status);
    res.json({ success: true, data: employee });
  } catch (err) { next(err); }
}
