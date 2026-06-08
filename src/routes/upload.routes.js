// src/routes/upload.routes.js
// Endpoints para subida de archivos a Supabase Storage

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middlewares/auth.middleware');
const uploadService = require('../services/upload.service');
const { supabase } = require('../config/supabase');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');

// Multer en memoria (no guarda en disco, procesa en RAM)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo imagenes y PDF.'));
    }
  },
});

// POST /api/v1/upload/avatar
// Sube o actualiza la foto de perfil del usuario autenticado
router.post('/avatar', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return sendError(res, 'No se recibio ningun archivo', 400);

    const url = await uploadService.uploadAvatar(
      req.user.id,
      req.file.buffer,
      req.file.mimetype,
    );

    return sendSuccess(res, { avatar_url: url }, 'Foto de perfil actualizada');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// POST /api/v1/upload/session/:sessionId
// Sube un archivo de evidencia a una sesion
router.post('/session/:sessionId', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return sendError(res, 'No se recibio ningun archivo', 400);

    // Verificar que el usuario pertenece a la sesion (tutor o inscrito)
    const { data: session } = await supabase
      .from('sessions')
      .select('tutor_id')
      .eq('id', req.params.sessionId)
      .single();

    if (!session) return sendError(res, 'Sesion no encontrada', 404);

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('session_id', req.params.sessionId)
      .eq('user_id', req.user.id)
      .single();

    const isTutor = session.tutor_id === req.user.id;
    const isEnrolled = !!enrollment;

    if (!isTutor && !isEnrolled) {
      return sendError(res, 'No tienes permiso para subir archivos a esta sesion', 403);
    }

    const url = await uploadService.uploadSessionFile(
      req.params.sessionId,
      req.user.id,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    return sendCreated(res, { file_url: url }, 'Archivo subido exitosamente');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// GET /api/v1/upload/session/:sessionId/files
// Lista los archivos de una sesion
router.get('/session/:sessionId/files', authenticate, async (req, res) => {
  try {
    const { data: session } = await supabase
      .from('sessions')
      .select('evidence_urls, tutor_id')
      .eq('id', req.params.sessionId)
      .single();

    if (!session) return sendError(res, 'Sesion no encontrada', 404);

    return sendSuccess(res, { files: session.evidence_urls || [] });
  } catch (err) {
    return sendError(res, 'Error obteniendo archivos', 500);
  }
});

module.exports = router;
