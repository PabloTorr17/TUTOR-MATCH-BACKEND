// src/services/notifications.service.js
// Notificaciones push via Firebase Cloud Messaging

const { supabase } = require('../config/supabase');

// Firebase Admin SDK — instalar: npm install firebase-admin
let admin;
try {
  admin = require('firebase-admin');

  // Inicializar solo si no esta ya inicializado
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (e) {
  console.warn('Firebase Admin no disponible. Notificaciones push desactivadas.');
}

/**
 * Registra o actualiza el device token de un usuario
 */
const registerToken = async (userId, token, platform) => {
  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      { user_id: userId, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    );

  if (error) throw { status: 500, message: 'Error registrando token' };
  return { registered: true };
};

/**
 * Elimina el device token al cerrar sesion
 */
const removeToken = async (userId, token) => {
  await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
};

/**
 * Envia notificacion push a un usuario especifico
 */
const sendToUser = async (userId, { title, body, data = {} }) => {
  if (!admin) return; // Firebase no configurado

  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map(({ token }) => ({
    token,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'tutormatch_default' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  }));

  // Enviar en batch
  try {
    const response = await admin.messaging().sendEach(messages);
    // Limpiar tokens invalidos
    const invalidTokens = response.responses
      .map((r, i) => r.success ? null : tokens[i].token)
      .filter(Boolean);

    if (invalidTokens.length > 0) {
      await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', userId)
        .in('token', invalidTokens);
    }
  } catch (e) {
    console.error('Error enviando push:', e);
  }
};

/**
 * Notifica al tutor cuando alguien se inscribe a su asesoria
 */
const notifyTutorOnEnrollment = async (sessionId, studentId) => {
  const { data: session } = await supabase
    .from('sessions')
    .select('tutor_id, title')
    .eq('id', sessionId)
    .single();

  const { data: student } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', studentId)
    .single();

  if (!session || !student) return;

  await sendToUser(session.tutor_id, {
    title: 'Nuevo inscrito en tu asesoria',
    body: `${student.full_name} se unio a "${session.title}"`,
    data: { type: 'enrollment', session_id: sessionId },
  });
};

/**
 * Notifica a usuarios interesados cuando se crea una nueva asesoria
 * Busca usuarios cuya lista de interests incluya la materia de la sesion
 */
const notifyInterestedUsers = async (session) => {
  if (!admin) return;

  // Buscar usuarios interesados en esta materia (excluir al tutor)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id')
    .contains('interests', [session.subject])
    .neq('user_id', session.tutor_id);

  if (!profiles || profiles.length === 0) return;

  const notifications = profiles.map(p =>
    sendToUser(p.user_id, {
      title: 'Nueva asesoria disponible',
      body: `"${session.title}" - ${session.subject}`,
      data: {
        type: 'new_session',
        session_id: session.id,
        subject: session.subject,
      },
    })
  );

  await Promise.allSettled(notifications);
};

module.exports = {
  registerToken,
  removeToken,
  sendToUser,
  notifyTutorOnEnrollment,
  notifyInterestedUsers,
};
