// src/routes/reviews.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const reviewsService = require('../services/reviews.service');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');

const reviewValidators = [
  body('session_id').isUUID().withMessage('ID de sesión inválido'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating debe ser entre 1 y 5'),
  body('comment').optional().isLength({ max: 500 }),
];

// POST /api/v1/reviews - Crear reseña
router.post('/', authenticate, reviewValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  try {
    const review = await reviewsService.createReview(req.user.id, req.body);
    return sendCreated(res, review, 'Reseña publicada exitosamente');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// GET /api/v1/reviews/tutor/:tutorId - Reseñas de un tutor
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await reviewsService.getTutorReviews(req.params.tutorId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return sendPaginated(res, result.reviews, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: result.total,
    });
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

module.exports = router;
