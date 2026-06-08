// src/routes/google-auth.routes.js
// Rutas para autenticacion con Google

const express = require('express');
const router = express.Router();
const googleAuthService = require('../services/google-auth.service');
const { authenticate } = require('../middlewares/auth.middleware');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');

// POST /api/v1/auth/google
// Recibe el token de Supabase Auth (post-OAuth de Google) y devuelve JWT propios
router.post('/google', async (req, res) => {
  try {
    const { supabase_token } = req.body;
    if (!supabase_token) {
      return sendError(res, 'supabase_token es requerido', 400);
    }

    const result = await googleAuthService.loginWithGoogle(supabase_token);

    const message = result.isNew
      ? 'Cuenta creada con Google. Completa tu perfil.'
      : 'Bienvenido de vuelta';

    return result.isNew
      ? sendCreated(res, result, message)
      : sendSuccess(res, result, message);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// POST /api/v1/auth/google/complete-profile
// Para usuarios nuevos de Google que deben completar carrera y semestre
router.post('/google/complete-profile', authenticate, async (req, res) => {
  try {
    const { career, semester } = req.body;
    if (!career || !semester) {
      return sendError(res, 'career y semester son requeridos', 400);
    }

    const user = await googleAuthService.completeGoogleProfile(
      req.user.id,
      { career, semester }
    );

    return sendSuccess(res, { user }, 'Perfil completado');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

module.exports = router;


// ================================================================
// CAMBIOS ADICIONALES EN sessions.service.js
// En la funcion createSession, DESPUES de crear la sesion exitosamente,
// agrega estas lineas para notificar a usuarios interesados:
// ================================================================
/*
const notifService = require('./notifications.service');

// Al final de createSession, antes del return:
notifService.notifyInterestedUsers(session).catch(console.error);
return session;
*/

// ================================================================
// CAMBIOS ADICIONALES EN enrollInSession (sessions.service.js)
// Despues de crear el enrollment exitosamente:
// ================================================================
/*
const notifService = require('./notifications.service');

// Al final de enrollInSession, antes del return:
notifService.notifyTutorOnEnrollment(sessionId, userId).catch(console.error);
return enrollment;
*/
