// src/validators/auth.validators.js
const { body } = require('express-validator');

const registerValidators = [
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 255 }),

  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe tener mayúsculas, minúsculas y números'),

  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Nombre requerido (2-100 caracteres)'),

  body('career')
    .trim()
    .notEmpty().withMessage('La carrera es requerida')
    .isLength({ max: 100 }),

  body('semester')
    .isInt({ min: 1, max: 12 }).withMessage('Semestre inválido (1-12)'),
];

const loginValidators = [
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').notEmpty().withMessage('Contraseña requerida'),
];

const changePasswordValidators = [
  body('currentPassword').notEmpty().withMessage('Contraseña actual requerida'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La nueva contraseña debe tener mayúsculas, minúsculas y números'),
];

module.exports = { registerValidators, loginValidators, changePasswordValidators };
