// src/routes/sessions.routes.js
const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessions.controller');
const { authenticate, optionalAuth, requireRole } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');

const sessionValidators = [
  body('title').trim().isLength({ min: 5, max: 150 }).withMessage('Título inválido (5-150 chars)'),
  body('subject').trim().notEmpty().withMessage('Materia requerida'),
  body('modality').isIn(['presential', 'virtual']).withMessage('Modalidad inválida'),
  body('scheduled_at').isISO8601().withMessage('Fecha inválida'),
  body('duration_minutes').optional().isInt({ min: 15, max: 480 }),
  body('max_spots').optional().isInt({ min: 1, max: 30 }),
  body('cost').optional().isFloat({ min: 0 }),
];

// GET /api/v1/sessions - Listar asesorías (público, con auth opcional)
router.get('/', optionalAuth, sessionsController.getAll);

// GET /api/v1/sessions/:id - Detalle de asesoría
router.get('/:id', optionalAuth, sessionsController.getById);

// POST /api/v1/sessions - Crear asesoría (requiere rol tutor)
router.post('/', authenticate, sessionValidators, sessionsController.create);

// POST /api/v1/sessions/quick - Crear asesoría rápida
router.post('/quick', authenticate, sessionsController.createQuick);

// POST /api/v1/sessions/:id/enroll - Inscribirse
router.post('/:id/enroll', authenticate, sessionsController.enroll);

// DELETE /api/v1/sessions/:id/enroll - Cancelar inscripción
router.delete('/:id/enroll', authenticate, sessionsController.unenroll);

// PATCH /api/v1/sessions/:id/status - Cambiar estado
router.patch('/:id/status', authenticate, sessionsController.updateStatus);

module.exports = router;
