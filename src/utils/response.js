// src/utils/response.js
// Helpers para respuestas HTTP estandarizadas

/**
 * Respuesta exitosa
 */
const sendSuccess = (res, data = null, message = 'Operación exitosa', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Respuesta de creación exitosa
 */
const sendCreated = (res, data, message = 'Recurso creado exitosamente') => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Respuesta de error
 */
const sendError = (res, message = 'Error interno del servidor', statusCode = 500, code = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (code) response.code = code;

  return res.status(statusCode).json(response);
};

/**
 * Respuesta de validación fallida
 */
const sendValidationError = (res, errors) => {
  return res.status(422).json({
    success: false,
    message: 'Error de validación',
    errors,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Respuesta paginada
 */
const sendPaginated = (res, data, pagination, message = 'Datos obtenidos exitosamente') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1,
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = { sendSuccess, sendCreated, sendError, sendValidationError, sendPaginated };
