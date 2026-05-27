// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  registerValidators,
  loginValidators,
  changePasswordValidators,
} = require('../validators/auth.validators');

// POST /api/v1/auth/register
router.post('/register', registerValidators, authController.register);

// POST /api/v1/auth/login
router.post('/login', loginValidators, authController.login);

// POST /api/v1/auth/refresh
router.post('/refresh', authController.refresh);

// GET /api/v1/auth/me  (requiere autenticación)
router.get('/me', authenticate, authController.me);

// POST /api/v1/auth/change-password  (requiere autenticación)
router.post('/change-password', authenticate, changePasswordValidators, authController.changePassword);

// POST /api/v1/auth/add-role  (requiere autenticación)
router.post('/add-role', authenticate, authController.addRole);

module.exports = router;
