// src/routes/notifications.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const notifService = require('../services/notifications.service');
const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

// POST /api/v1/notifications/token
// Registrar device token para push notifications
router.post('/token', authenticate, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token || !platform) return sendError(res, 'token y platform son requeridos', 400);

    const result = await notifService.registerToken(req.user.id, token, platform);
    return sendSuccess(res, result, 'Token registrado');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// DELETE /api/v1/notifications/token
// Eliminar device token al cerrar sesion
router.delete('/token', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return sendError(res, 'token es requerido', 400);

    await notifService.removeToken(req.user.id, token);
    return sendSuccess(res, null, 'Token eliminado');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// GET /api/v1/notifications
// Obtener notificaciones del usuario
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;
    return sendSuccess(res, { notifications: data, total: count });
  } catch (err) {
    return sendError(res, 'Error obteniendo notificaciones', 500);
  }
});

// PATCH /api/v1/notifications/:id/read
// Marcar notificacion como leida
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    return sendSuccess(res, null, 'Notificacion marcada como leida');
  } catch (err) {
    return sendError(res, 'Error actualizando notificacion', 500);
  }
});

// PATCH /api/v1/notifications/read-all
// Marcar todas como leidas
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .is('read_at', null);

    return sendSuccess(res, null, 'Todas las notificaciones marcadas como leidas');
  } catch (err) {
    return sendError(res, 'Error actualizando notificaciones', 500);
  }
});

// PUT /api/v1/notifications/interests
// Actualizar materias de interes para notificaciones
router.put('/interests', authenticate, async (req, res) => {
  try {
    const { interests } = req.body;
    if (!Array.isArray(interests)) return sendError(res, 'interests debe ser un arreglo', 400);

    const { error } = await supabase
      .from('profiles')
      .update({ interests })
      .eq('user_id', req.user.id);

    if (error) throw error;
    return sendSuccess(res, { interests }, 'Intereses actualizados');
  } catch (err) {
    return sendError(res, 'Error actualizando intereses', 500);
  }
});

module.exports = router;
