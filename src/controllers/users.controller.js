// src/controllers/users.controller.js
const usersService = require('../services/users.service');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const getProfile = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const profile = await usersService.getUserProfile(userId);
    return sendSuccess(res, profile);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const updateProfile = async (req, res) => {
  try {
    const profile = await usersService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, profile, 'Perfil actualizado exitosamente');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const getTutors = async (req, res) => {
  try {
    const { page = 1, limit = 12, ...filters } = req.query;
    const { tutors, total } = await usersService.getTutors(filters, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return sendPaginated(res, tutors, { page: parseInt(page), limit: parseInt(limit), total });
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const getHistory = async (req, res) => {
  try {
    const history = await usersService.getUserHistory(req.user.id);
    return sendSuccess(res, history);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const toggleFavorite = async (req, res) => {
  try {
    const result = await usersService.toggleFavorite(req.user.id, req.params.sessionId);
    return sendSuccess(res, result, result.favorited ? 'Guardado en favoritos' : 'Eliminado de favoritos');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const getFavorites = async (req, res) => {
  try {
    const favorites = await usersService.getFavorites(req.user.id);
    return sendSuccess(res, favorites);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

module.exports = { getProfile, updateProfile, getTutors, getHistory, toggleFavorite, getFavorites };
