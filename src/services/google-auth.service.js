// src/services/google-auth.service.js
// Autenticacion con Google via Supabase OAuth

const { supabase } = require('../config/supabase');
const { generateTokenPair } = require('../config/jwt');

/**
 * Procesa el login con Google.
 * Supabase maneja el OAuth con Google directamente.
 * Este endpoint recibe el access_token de Supabase y crea/busca al usuario.
 *
 * Flujo:
 * 1. El cliente hace login con Google via Supabase (en el frontend)
 * 2. Supabase devuelve un session con access_token
 * 3. El cliente envia ese token a este endpoint
 * 4. El backend verifica el token con Supabase y obtiene los datos del usuario
 * 5. Crea o recupera el usuario en nuestra tabla users
 * 6. Devuelve nuestros propios JWT
 */
const loginWithGoogle = async (supabaseAccessToken) => {
  // Verificar el token de Supabase y obtener el usuario
  const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(supabaseAccessToken);

  if (error || !supabaseUser) {
    throw { status: 401, message: 'Token de Google invalido' };
  }

  const email = supabaseUser.email;
  const googleId = supabaseUser.id;
  const fullName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || email.split('@')[0];
  const avatarUrl = supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture;

  // Buscar si ya existe el usuario
  let { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    // Actualizar google_id si no lo tenia
    if (!existingUser.google_id) {
      await supabase
        .from('users')
        .update({
          google_id: googleId,
          auth_provider: 'google',
          avatar_url: avatarUrl || existingUser.avatar_url,
          last_login_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      existingUser.google_id = googleId;
    }

    const { password_hash, ...safeUser } = existingUser;
    const tokens = generateTokenPair(safeUser);
    return { user: safeUser, tokens, isNew: false };
  }

  // Crear nuevo usuario con Google
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password_hash: 'GOOGLE_OAUTH_NO_PASSWORD', // No tiene password
      full_name: fullName,
      career: '', // Se completa en onboarding
      semester: 1,
      roles: ['tutee'],
      avatar_url: avatarUrl,
      google_id: googleId,
      auth_provider: 'google',
      is_active: true,
    })
    .select('id, email, full_name, career, semester, roles, avatar_url, google_id, auth_provider')
    .single();

  if (createError) {
    console.error('Error creando usuario Google:', createError);
    throw { status: 500, message: 'Error al crear la cuenta' };
  }

  const tokens = generateTokenPair(newUser);
  return { user: newUser, tokens, isNew: true };
};

/**
 * Completa el perfil de un usuario nuevo de Google
 * (carrera y semestre que no vienen del OAuth)
 */
const completeGoogleProfile = async (userId, { career, semester }) => {
  const { data, error } = await supabase
    .from('users')
    .update({ career, semester: parseInt(semester) })
    .eq('id', userId)
    .select('id, email, full_name, career, semester, roles, avatar_url')
    .single();

  if (error) throw { status: 500, message: 'Error completando perfil' };
  return data;
};

module.exports = { loginWithGoogle, completeGoogleProfile };
