// src/controllers/sessions.controller.js
const sessionsService = require('../services/sessions.service');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { validationResult } = require('express-validator');

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  try {
    const session = await sessionsService.createSession(req.user.id, req.body);
    return sendCreated(res, session, 'Asesoría creada exitosamente');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, ...filters } = req.query;
    const { sessions, total } = await sessionsService.getSessions(filters, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 50),
    });
    return sendPaginated(res, sessions, { page: parseInt(page), limit: parseInt(limit), total });
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const getById = async (req, res) => {
  try {
    const session = await sessionsService.getSessionById(req.params.id, req.user?.id);
    return sendSuccess(res, session);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const enroll = async (req, res) => {
  try {
    const enrollment = await sessionsService.enrollInSession(req.params.id, req.user.id);
    return sendCreated(res, enrollment, '¡Te has inscrito exitosamente!');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const unenroll = async (req, res) => {
  try {
    const result = await sessionsService.unenrollFromSession(req.params.id, req.user.id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await sessionsService.updateSessionStatus(req.params.id, req.user.id, status);
    return sendSuccess(res, updated, 'Estado actualizado');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const createQuick = async (req, res) => {
  try {
    const session = await sessionsService.createQuickSession(req.user.id, req.body);
    return sendCreated(res, session, '¡Asesoría rápida publicada!');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

module.exports = { create, getAll, getById, enroll, unenroll, updateStatus, createQuick };
