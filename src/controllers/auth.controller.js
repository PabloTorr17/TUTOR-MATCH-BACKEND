// src/controllers/auth.controller.js
const authService = require('../services/auth.service');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');
const { validationResult } = require('express-validator');

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  try {
    const { user, tokens } = await authService.register(req.body);
    return sendCreated(res, { user, tokens }, 'Registro exitoso. ¡Bienvenido a TutorMatch!');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  try {
    const { user, tokens } = await authService.login(req.body);
    return sendSuccess(res, { user, tokens }, 'Inicio de sesión exitoso');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return sendError(res, 'Refresh token requerido', 400);
  try {
    const result = await authService.refreshTokens(refreshToken);
    return sendSuccess(res, result, 'Token renovado exitosamente');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const addRole = async (req, res) => {
  try {
    const { role } = req.body;
    const updated = await authService.addRole(req.user.id, role);
    return sendSuccess(res, updated, `Rol '${role}' agregado exitosamente`);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const me = async (req, res) => {
  return sendSuccess(res, req.user, 'Datos del usuario autenticado');
};

module.exports = { register, login, refresh, changePassword, addRole, me };
