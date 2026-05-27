// src/middlewares/error.middleware.js
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error no manejado:', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'JSON inválido en el body de la petición',
    });
  }

  if (err.status === 413) {
    return res.status(413).json({
      success: false,
      message: 'El archivo es demasiado grande',
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  return res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Error interno del servidor'
        : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFoundHandler };
