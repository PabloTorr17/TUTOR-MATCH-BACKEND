// src/services/users.service.js
// Lógica de negocio para perfiles de usuarios

const { supabase } = require('../config/supabase');

/**
 * Obtiene el perfil completo de un usuario
 */
const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, email, full_name, career, semester, roles, avatar_url, 
      created_at, last_login_at,
      profile:profiles(
        bio, rating, total_sessions, attendance_rate, subjects,
        availability, badges, social_links
      ),
      sessions_as_tutor:sessions!sessions_tutor_id_fkey(
        id, title, subject, status, scheduled_at, modality
      )
    `)
    .eq('id', userId)
    .single();

  if (error) throw { status: 404, message: 'Usuario no encontrado' };

  return data;
};

/**
 * Actualiza el perfil de un usuario
 */
const updateProfile = async (userId, updates) => {
  const { full_name, career, semester, bio, subjects, availability, social_links } = updates;

  // Actualizar tabla users
  if (full_name || career || semester !== undefined) {
    const userUpdates = {};
    if (full_name) userUpdates.full_name = full_name;
    if (career) userUpdates.career = career;
    if (semester) userUpdates.semester = semester;

    await supabase.from('users').update(userUpdates).eq('id', userId);
  }

  // Actualizar tabla profiles
  const profileUpdates = {};
  if (bio !== undefined) profileUpdates.bio = bio;
  if (subjects) profileUpdates.subjects = subjects;
  if (availability) profileUpdates.availability = availability;
  if (social_links) profileUpdates.social_links = social_links;

  if (Object.keys(profileUpdates).length > 0) {
    await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('user_id', userId);
  }

  return getUserProfile(userId);
};

/**
 * Actualiza el avatar del usuario
 */
const updateAvatar = async (userId, avatarUrl) => {
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (error) throw { status: 500, message: 'Error actualizando avatar' };

  return { avatar_url: avatarUrl };
};

/**
 * Lista tutores con sus ratings
 */
const getTutors = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 12 } = pagination;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('users')
    .select(`
      id, full_name, career, semester, avatar_url, roles,
      profile:profiles(rating, total_sessions, attendance_rate, bio, subjects)
    `, { count: 'exact' })
    .contains('roles', ['tutor'])
    .eq('is_active', true)
    .range(offset, offset + limit - 1);

  if (filters.subject) {
    // Filtrar por materia en el array de subjects del perfil
    query = query.contains('profile.subjects', [filters.subject]);
  }
  if (filters.career) query = query.ilike('career', `%${filters.career}%`);
  if (filters.search) query = query.ilike('full_name', `%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) throw { status: 500, message: 'Error obteniendo tutores' };

  return { tutors: data, total: count };
};

/**
 * Historial de asesorías del usuario (como tutor y asesorado)
 */
const getUserHistory = async (userId) => {
  // Como asesorado
  const { data: asEnrolled } = await supabase
    .from('enrollments')
    .select(`
      id, status, enrolled_at,
      session:sessions(
        id, title, subject, scheduled_at, modality, status,
        tutor:users!sessions_tutor_id_fkey(full_name, avatar_url)
      )
    `)
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: false });

  // Como tutor
  const { data: asTutor } = await supabase
    .from('sessions')
    .select(`
      id, title, subject, scheduled_at, modality, status,
      enrollments(count)
    `)
    .eq('tutor_id', userId)
    .order('scheduled_at', { ascending: false });

  return {
    as_tutee: asEnrolled || [],
    as_tutor: asTutor || [],
  };
};

/**
 * Guarda o quita una asesoría de favoritos
 */
const toggleFavorite = async (userId, sessionId) => {
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .single();

  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id);
    return { favorited: false };
  } else {
    await supabase.from('favorites').insert({ user_id: userId, session_id: sessionId });
    return { favorited: true };
  }
};

/**
 * Lista favoritos del usuario
 */
const getFavorites = async (userId) => {
  const { data, error } = await supabase
    .from('favorites')
    .select(`
      session:sessions(
        id, title, subject, scheduled_at, modality, status, available_spots, cost,
        tutor:users!sessions_tutor_id_fkey(full_name, avatar_url)
      )
    `)
    .eq('user_id', userId);

  if (error) throw { status: 500, message: 'Error obteniendo favoritos' };

  return data.map(f => f.session);
};

module.exports = {
  getUserProfile,
  updateProfile,
  updateAvatar,
  getTutors,
  getUserHistory,
  toggleFavorite,
  getFavorites,
};
