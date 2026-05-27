// src/routes/users.routes.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// GET /api/v1/users/tutors - Lista de tutores (público)
router.get('/tutors', usersController.getTutors);

// GET /api/v1/users/me - Mi perfil
router.get('/me', authenticate, usersController.getProfile);

// PATCH /api/v1/users/me - Actualizar mi perfil
router.patch('/me', authenticate, usersController.updateProfile);

// GET /api/v1/users/me/history - Mi historial
router.get('/me/history', authenticate, usersController.getHistory);

// GET /api/v1/users/me/favorites - Mis favoritos
router.get('/me/favorites', authenticate, usersController.getFavorites);

// POST /api/v1/users/me/favorites/:sessionId - Toggle favorito
router.post('/me/favorites/:sessionId', authenticate, usersController.toggleFavorite);

// GET /api/v1/users/:id - Perfil público de cualquier usuario
router.get('/:id', usersController.getProfile);

module.exports = router;
