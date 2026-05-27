// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

// Todas las rutas de admin requieren autenticación y rol admin
router.use(authenticate, requireRole('admin'));

// GET /api/v1/admin/stats - Estadísticas generales
router.get('/stats', async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: totalTutors },
      { count: totalSessions },
      { count: completedSessions },
      { count: activeSessions },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).contains('roles', ['tutor']),
      supabase.from('sessions').select('*', { count: 'exact', head: true }),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'available'),
    ]);

    // Top materias
    const { data: topSubjects } = await supabase
      .from('sessions')
      .select('subject')
      .order('subject');

    const subjectCount = {};
    topSubjects?.forEach(s => {
      subjectCount[s.subject] = (subjectCount[s.subject] || 0) + 1;
    });
    const subjects = Object.entries(subjectCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([subject, count]) => ({ subject, count }));

    return sendSuccess(res, {
      users: { total: totalUsers, tutors: totalTutors, tutees: totalUsers - totalTutors },
      sessions: { total: totalSessions, completed: completedSessions, active: activeSessions },
      top_subjects: subjects,
    });
  } catch (err) {
    return sendError(res, 'Error obteniendo estadísticas', 500);
  }
});

// GET /api/v1/admin/users - Lista de usuarios
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('users')
      .select('id, email, full_name, career, roles, is_active, created_at, last_login_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) query = query.ilike('full_name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({ success: true, data, total: count });
  } catch (err) {
    return sendError(res, 'Error obteniendo usuarios', 500);
  }
});

// PATCH /api/v1/admin/users/:id/toggle - Activar/desactivar usuario
router.patch('/users/:id/toggle', async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('is_active').eq('id', req.params.id).single();
    if (!user) return sendError(res, 'Usuario no encontrado', 404);

    const { data: updated } = await supabase
      .from('users')
      .update({ is_active: !user.is_active })
      .eq('id', req.params.id)
      .select('id, email, is_active')
      .single();

    return sendSuccess(res, updated, `Usuario ${updated.is_active ? 'activado' : 'desactivado'}`);
  } catch (err) {
    return sendError(res, 'Error actualizando usuario', 500);
  }
});

module.exports = router;
