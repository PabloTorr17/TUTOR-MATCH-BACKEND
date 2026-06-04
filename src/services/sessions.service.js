// src/services/sessions.service.js
// Lógica de negocio para asesorías

const { supabase } = require('../config/supabase');

/**
 * Crea una nueva asesoría
 */
const createSession = async (tutorId, data) => {
  const { data: tutor } = await supabase
    .from('users')
    .select('roles')
    .eq('id', tutorId)
    .single();

  if (!tutor.roles.includes('tutor')) {
    throw { status: 403, message: 'Necesitas el rol de tutor para crear asesorías. Ve a tu perfil para activarlo.' };
  }

  const {
    title, subject, description, modality, location, meet_link,
    scheduled_at, duration_minutes, max_spots, cost, difficulty,
    session_type, tags,
  } = data;

  const { data: session, error: createError } = await supabase
    .from('sessions')
    .insert({
      tutor_id: tutorId,
      title,
      subject,
      description,
      modality,
      location: modality === 'presential' ? location : null,
      meet_link: modality === 'virtual' ? meet_link : null,
      scheduled_at,
      duration_minutes: duration_minutes || 60,
      max_spots: max_spots || 1,
      available_spots: max_spots || 1,
      cost: cost || 0,
      difficulty: difficulty || 'intermediate',
      session_type: session_type || 'scheduled',
      tags: tags || [],
      status: 'available',
    })
    .select(`
      *,
      tutor:users!sessions_tutor_id_fkey(
        id, full_name, avatar_url, career,
        profile:profiles(rating, total_sessions)
      )
    `)
    .single();

  if (createError) {
    console.error('SUPABASE ERROR createSession:', JSON.stringify(createError, null, 2));
    throw { status: 500, message: createError.message };
  }

  return session;
};

/**
 * Lista asesorías con filtros
 */
const getSessions = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('sessions')
    .select(`
      *,
      tutor:users!sessions_tutor_id_fkey(
        id, full_name, avatar_url, career, semester,
        profile:profiles(rating, total_sessions, attendance_rate)
      ),
      enrollments(count)
    `, { count: 'exact' })
    .eq('status', 'available')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (filters.subject) query = query.ilike('subject', `%${filters.subject}%`);
  if (filters.modality) query = query.eq('modality', filters.modality);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
  if (filters.session_type) query = query.eq('session_type', filters.session_type);
  if (filters.max_cost !== undefined) query = query.lte('cost', filters.max_cost);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
  }
  if (filters.tutor_id) query = query.eq('tutor_id', filters.tutor_id);

  const { data: sessions, error: listError, count } = await query;

  if (listError) {
    console.error('SUPABASE ERROR getSessions:', JSON.stringify(listError, null, 2));
    throw { status: 500, message: listError.message };
  }

  return { sessions, total: count };
};

/**
 * Obtiene una asesoría por ID con todos sus detalles
 */
const getSessionById = async (sessionId, userId = null) => {
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select(`
      *,
      tutor:users!sessions_tutor_id_fkey(
        id, full_name, avatar_url, career, semester, email,
        profile:profiles(rating, total_sessions, attendance_rate, bio, subjects)
      ),
      enrollments(
        id, user_id, status, enrolled_at,
        user:users(id, full_name, avatar_url, career)
      )
    `)
    .eq('id', sessionId)
    .single();

  if (fetchError) throw { status: 404, message: 'Asesoría no encontrada' };

  if (userId) {
    session.is_enrolled = session.enrollments?.some(e => e.user_id === userId && e.status === 'confirmed');
    session.is_owner = session.tutor_id === userId;
  }

  return session;
};

/**
 * Inscribe a un usuario en una asesoría
 */
const enrollInSession = async (sessionId, userId) => {
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) throw { status: 404, message: 'Asesoría no encontrada' };
  if (session.tutor_id === userId) throw { status: 400, message: 'No puedes inscribirte en tu propia asesoría' };
  if (session.status !== 'available') throw { status: 400, message: 'Esta asesoría no está disponible' };
  if (session.available_spots <= 0) throw { status: 400, message: 'No hay lugares disponibles' };

  const { data: existing } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    if (existing.status === 'confirmed') throw { status: 409, message: 'Ya estás inscrito en esta asesoría' };
    const { data: reactivated } = await supabase
      .from('enrollments')
      .update({ status: 'confirmed', enrolled_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    return reactivated;
  }

  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .insert({ session_id: sessionId, user_id: userId, status: 'confirmed' })
    .select()
    .single();

  if (enrollError) throw { status: 500, message: 'Error al inscribirse' };

  await supabase
    .from('sessions')
    .update({
      available_spots: session.available_spots - 1,
      status: session.available_spots - 1 === 0 ? 'full' : 'available',
    })
    .eq('id', sessionId);

  return enrollment;
};

/**
 * Cancela inscripción en una asesoría
 */
const unenrollFromSession = async (sessionId, userId) => {
  const { data: enrollment, error: unenrollError } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single();

  if (unenrollError || !enrollment) throw { status: 404, message: 'No estás inscrito en esta asesoría' };
  if (enrollment.status === 'cancelled') throw { status: 400, message: 'Ya cancelaste esta inscripción' };

  await supabase
    .from('enrollments')
    .update({ status: 'cancelled' })
    .eq('id', enrollment.id);

  const { data: session } = await supabase
    .from('sessions')
    .select('available_spots, max_spots, status')
    .eq('id', sessionId)
    .single();

  if (session) {
    await supabase
      .from('sessions')
      .update({
        available_spots: Math.min(session.available_spots + 1, session.max_spots),
        status: 'available',
      })
      .eq('id', sessionId);
  }

  return { message: 'Inscripción cancelada exitosamente' };
};

/**
 * Actualiza el estado de una asesoría
 */
const updateSessionStatus = async (sessionId, tutorId, newStatus) => {
  const validStatuses = ['available', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw { status: 400, message: `Estado inválido. Estados válidos: ${validStatuses.join(', ')}` };
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('tutor_id')
    .eq('id', sessionId)
    .single();

  if (!session) throw { status: 404, message: 'Asesoría no encontrada' };
  if (session.tutor_id !== tutorId) throw { status: 403, message: 'Solo el tutor puede cambiar el estado' };

  const { data: updated, error: updateError } = await supabase
    .from('sessions')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();

  if (updateError) throw { status: 500, message: 'Error actualizando estado' };

  return updated;
};

/**
 * Asesorías rápidas
 */
const createQuickSession = async (tutorId, { subject, description }) => {
  return createSession(tutorId, {
    title: `Ayuda rápida: ${subject}`,
    subject,
    description,
    modality: 'virtual',
    session_type: 'quick',
    scheduled_at: new Date().toISOString(),
    duration_minutes: 30,
    max_spots: 1,
    cost: 0,
    difficulty: 'any',
    status: 'available',
  });
};

module.exports = {
  createSession,
  getSessions,
  getSessionById,
  enrollInSession,
  unenrollFromSession,
  updateSessionStatus,
  createQuickSession,
};