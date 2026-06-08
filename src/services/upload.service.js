// src/services/upload.service.js
// Subida de archivos a Supabase Storage

const { supabase } = require('../config/supabase');
const { randomUUID } = require('crypto');

/**
 * Sube un avatar de usuario a Supabase Storage
 * @param {string} userId - ID del usuario
 * @param {Buffer} buffer - Buffer del archivo
 * @param {string} mimeType - Tipo MIME (image/jpeg, image/png, etc)
 * @returns {string} URL publica del avatar
 */
const uploadAvatar = async (userId, buffer, mimeType) => {
  const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true, // Sobreescribe si ya existe
    });

  if (error) {
    console.error('Error subiendo avatar:', error);
    throw { status: 500, message: 'Error al subir la imagen' };
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);

  // Actualizar avatar_url en users
  await supabase
    .from('users')
    .update({ avatar_url: data.publicUrl })
    .eq('id', userId);

  return data.publicUrl;
};

/**
 * Sube un archivo de evidencia de sesion
 * @param {string} sessionId - ID de la sesion
 * @param {string} userId - ID del usuario que sube
 * @param {Buffer} buffer - Buffer del archivo
 * @param {string} mimeType - Tipo MIME
 * @param {string} originalName - Nombre original del archivo
 * @returns {string} URL publica del archivo
 */
const uploadSessionFile = async (sessionId, userId, buffer, mimeType, originalName) => {
  const ext = originalName.split('.').pop();
  const fileName = `${randomUUID()}.${ext}`;
  const path = `${sessionId}/${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from('session-files')
    .upload(path, buffer, { contentType: mimeType });

  if (error) {
    console.error('Error subiendo archivo de sesion:', error);
    throw { status: 500, message: 'Error al subir el archivo' };
  }

  const { data } = supabase.storage.from('session-files').getPublicUrl(path);

  // Agregar URL al arreglo evidence_urls de la sesion
  const { data: session } = await supabase
    .from('sessions')
    .select('evidence_urls')
    .eq('id', sessionId)
    .single();

  const currentUrls = session?.evidence_urls || [];
  await supabase
    .from('sessions')
    .update({ evidence_urls: [...currentUrls, data.publicUrl] })
    .eq('id', sessionId);

  return data.publicUrl;
};

/**
 * Elimina un archivo del storage
 */
const deleteFile = async (bucket, path) => {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error('Error eliminando archivo:', error);
};

module.exports = { uploadAvatar, uploadSessionFile, deleteFile };
