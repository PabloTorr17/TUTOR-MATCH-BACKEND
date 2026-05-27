// src/services/auth.service.js
// Lógica de negocio para autenticación

const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { generateTokenPair, verifyRefreshToken } = require('../config/jwt');

const SALT_ROUNDS = 12;

/**
 * Registra un nuevo usuario
 */
const register = async ({ email, password, full_name, career, semester }) => {
  // Verificar si el email ya existe
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    throw { status: 409, message: 'El correo electrónico ya está registrado' };
  }

  // Hash de la contraseña
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // Crear usuario
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password_hash,
      full_name,
      career,
      semester,
      roles: ['tutee'], // Rol inicial como asesorado
      is_active: true,
    })
    .select('id, email, full_name, career, semester, roles, avatar_url, created_at')
    .single();

  if (error) {
    console.error('Error creando usuario:', error);
    throw { status: 500, message: 'Error al crear el usuario' };
  }

  // Crear perfil inicial
  await supabase.from('profiles').insert({
    user_id: user.id,
    bio: '',
    rating: 0,
    total_sessions: 0,
    attendance_rate: 100,
  });

  const tokens = generateTokenPair(user);

  return { user, tokens };
};

/**
 * Inicia sesión con email y contraseña
 */
const login = async ({ email, password }) => {
  // Buscar usuario con contraseña
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, full_name, roles, is_active, avatar_url, career, semester')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) {
    throw { status: 401, message: 'Credenciales incorrectas' };
  }

  if (!user.is_active) {
    throw { status: 403, message: 'Cuenta desactivada. Contacta al administrador.' };
  }

  // Verificar contraseña
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw { status: 401, message: 'Credenciales incorrectas' };
  }

  // Actualizar último login
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  // No enviar el hash de contraseña
  const { password_hash, ...safeUser } = user;

  const tokens = generateTokenPair(safeUser);

  return { user: safeUser, tokens };
};

/**
 * Renueva el access token con un refresh token válido
 */
const refreshTokens = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw { status: 401, message: 'Refresh token inválido o expirado' };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, roles, is_active, avatar_url')
    .eq('id', decoded.id)
    .single();

  if (error || !user || !user.is_active) {
    throw { status: 401, message: 'Usuario no válido' };
  }

  const tokens = generateTokenPair(user);
  return { user, tokens };
};

/**
 * Cambia la contraseña del usuario
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const { data: user } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .single();

  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw { status: 400, message: 'La contraseña actual es incorrecta' };
  }

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await supabase.from('users').update({ password_hash }).eq('id', userId);

  return { message: 'Contraseña actualizada exitosamente' };
};

/**
 * Agrega un rol al usuario (tutor, tutee, admin)
 */
const addRole = async (userId, role) => {
  const validRoles = ['tutor', 'tutee', 'admin'];
  if (!validRoles.includes(role)) {
    throw { status: 400, message: `Rol inválido. Roles válidos: ${validRoles.join(', ')}` };
  }

  const { data: user } = await supabase
    .from('users')
    .select('roles')
    .eq('id', userId)
    .single();

  if (user.roles.includes(role)) {
    throw { status: 409, message: `El usuario ya tiene el rol de ${role}` };
  }

  const newRoles = [...user.roles, role];
  const { data: updated } = await supabase
    .from('users')
    .update({ roles: newRoles })
    .eq('id', userId)
    .select('id, email, roles')
    .single();

  return updated;
};

module.exports = { register, login, refreshTokens, changePassword, addRole };
