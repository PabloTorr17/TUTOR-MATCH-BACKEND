// src/index.js
// Punto de entrada del servidor TutorMatch

require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { verifyAccessToken } = require('./config/jwt');

const PORT = process.env.PORT || 3000;

// Crear servidor HTTP
const server = http.createServer(app);

// ============ SOCKET.IO - TIEMPO REAL ============
const io = new Server(server, {
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware de autenticación para Socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Token requerido para tiempo real'));

  try {
    const decoded = verifyAccessToken(token);
    socket.userId = decoded.id;
    socket.userRoles = decoded.roles;
    next();
  } catch (err) {
    next(new Error('Token inválido'));
  }
});

// Mapa de usuarios conectados: userId -> socketId
const connectedUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.userId;
  connectedUsers.set(userId, socket.id);

  console.log(`🟢 Usuario conectado: ${userId} (socket: ${socket.id})`);

  // Unirse a room personal para notificaciones directas
  socket.join(`user:${userId}`);

  // ============ EVENTOS DE CHAT ============

  // Unirse a una conversación
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conv:${conversationId}`);
  });

  // Nuevo mensaje (broadcast al receiver)
  socket.on('send_message', (data) => {
    const { receiver_id, conversation_id, message } = data;
    // Emitir al receiver si está conectado
    io.to(`user:${receiver_id}`).emit('new_message', {
      conversation_id,
      message,
    });
    // También emitir al room de la conversación
    io.to(`conv:${conversation_id}`).emit('message_received', message);
  });

  // Indicador de "escribiendo..."
  socket.on('typing', ({ conversation_id, receiver_id }) => {
    io.to(`user:${receiver_id}`).emit('user_typing', {
      conversation_id,
      user_id: userId,
    });
  });

  // ============ EVENTOS DE SESIONES ============

  // Unirse a la sala de una sesión (para updates en tiempo real)
  socket.on('join_session', (sessionId) => {
    socket.join(`session:${sessionId}`);
  });

  // Actualización de estado de sesión
  socket.on('session_status_update', ({ session_id, status }) => {
    io.to(`session:${session_id}`).emit('session_updated', { session_id, status });
  });

  // ============ NOTIFICACIONES ============

  // Helper para enviar notificación a un usuario específico
  socket.on('send_notification', ({ target_user_id, notification }) => {
    io.to(`user:${target_user_id}`).emit('notification', notification);
  });

  // ============ DESCONEXIÓN ============
  socket.on('disconnect', () => {
    connectedUsers.delete(userId);
    console.log(`🔴 Usuario desconectado: ${userId}`);
  });
});

// Exportar io para usarlo en otros módulos (ej: emitir desde controllers)
app.set('io', io);
app.set('connectedUsers', connectedUsers);

// ============ INICIO DEL SERVIDOR ============
server.listen(PORT, () => {
  console.log('\n');
  console.log('╔══════════════════════════════════════╗');
  console.log('║      🎓 TutorMatch API v1.0.0        ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  🚀 Servidor: http://localhost:${PORT}   ║`);
  console.log(`║  🌍 Entorno:  ${(process.env.NODE_ENV || 'development').padEnd(22)}║`);
  console.log('║  📡 Socket.io: Activo                ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('\n📋 Endpoints disponibles:');
  console.log('   POST /api/v1/auth/register');
  console.log('   POST /api/v1/auth/login');
  console.log('   GET  /api/v1/sessions');
  console.log('   GET  /api/v1/users/tutors');
  console.log('   GET  /health\n');
});

// Manejo de excepciones no capturadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
  process.exit(1);
});

module.exports = { server, io };
