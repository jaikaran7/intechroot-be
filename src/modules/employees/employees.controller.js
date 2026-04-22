import * as EmployeesService from './employees.service.js';

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
    const employee = await EmployeesService.updateEmployee(req.params.id, req.body);
    res.json({ success: true, data: employee });
  } catch (err) { next(err); }
}

export async function updateEmployeeStatus(req, res, next) {
  try {
    const employee = await EmployeesService.updateEmployeeStatus(req.params.id, req.body.status);
    res.json({ success: true, data: employee });
  } catch (err) { next(err); }
}
