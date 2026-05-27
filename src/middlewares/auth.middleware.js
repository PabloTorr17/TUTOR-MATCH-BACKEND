// src/middlewares/auth.middleware.js
// Middleware de autenticación JWT

const { verifyAccessToken } = require('../config/jwt');
const { supabase } = require('../config/supabase');
const { sendError } = require('../utils/response');

/**
 * Middleware principal de autenticación
 * Verifica el JWT y adjunta el usuario a req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Token de acceso requerido', 401);
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Token expirado. Usa el refresh token para renovarlo.', 401, 'TOKEN_EXPIRED');
      }
      return sendError(res, 'Token inválido', 401);
    }

    // Obtener usuario actualizado de la BD
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, roles, is_active, avatar_url')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return sendError(res, 'Usuario no encontrado', 401);
    }

    if (!user.is_active) {
      return sendError(res, 'Cuenta desactivada. Contacta al administrador.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error en authenticate middleware:', error);
    return sendError(res, 'Error de autenticación', 500);
  }
};

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero adjunta el usuario si existe
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  return authenticate(req, res, next);
};

/**
 * Factory para verificar roles
 * Uso: requireRole('admin') o requireRole(['tutor', 'admin'])
 */
const requireRole = (roles) => {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Autenticación requerida', 401);
    }

    const userRoles = req.user.roles || [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return sendError(
        res,
        `Acceso denegado. Se requiere rol: ${requiredRoles.join(' o ')}`,
        403
      );
    }

    next();
  };
};

module.exports = { authenticate, optionalAuth, requireRole };
