// backend_changes/payment.routes.js
// Agrega este archivo a src/routes/ y registralo en src/app.js
// ============================================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const paymentService = require('../services/payment.service');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');

// POST /api/v1/payments/create-intent
// Crea un PaymentIntent de Stripe para una asesoria de pago
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const { session_id, amount, currency } = req.body;

    if (!session_id) return sendError(res, 'session_id es requerido', 400);
    if (!amount || amount <= 0) return sendError(res, 'Monto invalido', 400);

    const result = await paymentService.createPaymentIntent(req.user.id, {
      session_id, amount, currency,
    });

    return sendCreated(res, result, 'PaymentIntent creado');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
});

// POST /api/v1/payments/webhook
// Endpoint que llama Stripe automaticamente cuando el pago cambia de estado
// IMPORTANTE: este endpoint debe recibir el body RAW (sin parsear como JSON)
// Registrarlo ANTES del middleware express.json() en app.js
router.post('/webhook',
  express.raw({ type: 'application/json' }), // body RAW para verificar firma
  async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'];
      const result = await paymentService.handleWebhook(req.body, signature);
      return res.json(result);
    } catch (err) {
      return sendError(res, err.message, err.status || 400);
    }
  }
);

module.exports = router;

// ============================================================
// AGREGAR EN src/app.js:
// ============================================================
// const paymentRoutes = require('./routes/payment.routes');
//
// // IMPORTANTE: el webhook debe ir ANTES de express.json()
// app.use(`${API_PREFIX}/payments/webhook`, express.raw({ type: 'application/json' }));
// app.use(express.json({ limit: '10mb' }));  // <- esto ya existe
// ...
// app.use(`${API_PREFIX}/payments`, paymentRoutes);
