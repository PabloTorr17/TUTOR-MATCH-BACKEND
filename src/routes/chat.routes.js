// src/routes/chat.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const chatService = require('../services/chat.service');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');

// GET /api/v1/chat - Mis conversaciones
router.get('/', authenticate, async (req, res) => {
  try {
    const chats = await chatService.getUserChats(req.user.id);
    return sendSuccess(res, chats);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// GET /api/v1/chat/:conversationId - Mensajes de una conversación
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const result = await chatService.getConversation(
      req.params.conversationId,
      req.user.id,
      { page: parseInt(page), limit: parseInt(limit) }
    );
    return sendPaginated(res, result.messages, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: result.total,
    });
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// POST /api/v1/chat/send - Enviar mensaje
router.post('/send', authenticate, async (req, res) => {
  try {
    const message = await chatService.sendMessage(req.user.id, req.body);
    return sendCreated(res, message);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

module.exports = router;
