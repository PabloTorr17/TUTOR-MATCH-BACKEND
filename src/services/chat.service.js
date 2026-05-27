// src/services/chat.service.js
// Mensajería en tiempo real (complementa Supabase Realtime)

const { supabase } = require('../config/supabase');

/**
 * Obtiene los chats del usuario (conversaciones)
 */
const getUserChats = async (userId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw { status: 500, message: 'Error obteniendo chats' };

  // Obtener conversaciones únicas con el último mensaje
  const conversationIds = [...new Set(data.map(m => m.conversation_id))];

  const chats = await Promise.all(
    conversationIds.map(async (convId) => {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select(`
          id, content, created_at, read_at, message_type,
          sender:users!messages_sender_id_fkey(id, full_name, avatar_url)
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { count: unread } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('conversation_id', convId)
        .eq('receiver_id', userId)
        .is('read_at', null);

      return { conversation_id: convId, last_message: lastMsg, unread_count: unread };
    })
  );

  return chats;
};

/**
 * Obtiene mensajes de una conversación
 */
const getConversation = async (conversationId, userId, pagination = {}) => {
  const { page = 1, limit = 30 } = pagination;
  const offset = (page - 1) * limit;

  // Verificar que el usuario pertenece a la conversación
  const { data: check } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .limit(1);

  if (!check || check.length === 0) {
    throw { status: 403, message: 'No tienes acceso a esta conversación' };
  }

  const { data: messages, error, count } = await supabase
    .from('messages')
    .select(`
      id, content, message_type, file_url, created_at, read_at,
      sender:users!messages_sender_id_fkey(id, full_name, avatar_url)
    `, { count: 'exact' })
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw { status: 500, message: 'Error obteniendo mensajes' };

  // Marcar mensajes como leídos
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('receiver_id', userId)
    .is('read_at', null);

  return { messages: messages.reverse(), total: count };
};

/**
 * Envía un mensaje
 */
const sendMessage = async (senderId, { receiver_id, content, message_type = 'text', file_url = null }) => {
  // Generar ID de conversación determinístico (siempre el mismo para 2 usuarios)
  const ids = [senderId, receiver_id].sort();
  const conversationId = `${ids[0]}_${ids[1]}`;

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id,
      content,
      message_type,
      file_url,
    })
    .select(`
      *,
      sender:users!messages_sender_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) throw { status: 500, message: 'Error enviando mensaje' };

  return message;
};

module.exports = { getUserChats, getConversation, sendMessage };
