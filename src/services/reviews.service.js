// src/services/reviews.service.js
// Sistema de calificaciones y comentarios

const { supabase } = require('../config/supabase');

/**
 * Crea una reseña para una asesoría completada
 */
const createReview = async (reviewerId, { session_id, rating, comment }) => {
  // Verificar que la asesoría existe y está completada
  const { data: session } = await supabase
    .from('sessions')
    .select('tutor_id, status')
    .eq('id', session_id)
    .single();

  if (!session) throw { status: 404, message: 'Asesoría no encontrada' };
  if (session.status !== 'completed') throw { status: 400, message: 'Solo puedes calificar asesorías completadas' };
  if (session.tutor_id === reviewerId) throw { status: 400, message: 'No puedes calificarte a ti mismo' };

  // Verificar que el usuario estuvo inscrito
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('session_id', session_id)
    .eq('user_id', reviewerId)
    .eq('status', 'confirmed')
    .single();

  if (!enrollment) throw { status: 403, message: 'Solo puedes calificar asesorías en las que participaste' };

  // Verificar que no existe reseña previa
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('session_id', session_id)
    .eq('reviewer_id', reviewerId)
    .single();

  if (existing) throw { status: 409, message: 'Ya calificaste esta asesoría' };

  // Crear reseña
  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      session_id,
      reviewer_id: reviewerId,
      reviewed_id: session.tutor_id,
      rating,
      comment,
    })
    .select(`
      *,
      reviewer:users!reviews_reviewer_id_fkey(full_name, avatar_url)
    `)
    .single();

  if (error) throw { status: 500, message: 'Error creando reseña' };

  // Actualizar rating promedio del tutor
  await updateTutorRating(session.tutor_id);

  return review;
};

/**
 * Recalcula y actualiza el rating de un tutor
 */
const updateTutorRating = async (tutorId) => {
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewed_id', tutorId);

  if (!reviews || reviews.length === 0) return;

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const rounded = Math.round(avg * 10) / 10; // 1 decimal

  await supabase
    .from('profiles')
    .update({ rating: rounded })
    .eq('user_id', tutorId);
};

/**
 * Obtiene reseñas de un tutor
 */
const getTutorReviews = async (tutorId, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('reviews')
    .select(`
      id, rating, comment, created_at,
      reviewer:users!reviews_reviewer_id_fkey(full_name, avatar_url),
      session:sessions(title, subject)
    `, { count: 'exact' })
    .eq('reviewed_id', tutorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw { status: 500, message: 'Error obteniendo reseñas' };

  return { reviews: data, total: count };
};

module.exports = { createReview, getTutorReviews };
