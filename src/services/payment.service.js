// ============================================================
// CAMBIOS AL BACKEND PARA STRIPE
// Agrega estos archivos a tu proyecto de backend existente
// ============================================================

// 1. INSTALAR DEPENDENCIA
// npm install stripe

// 2. AGREGAR A .env
// STRIPE_SECRET_KEY=sk_test_TU_CLAVE_SECRETA_DE_STRIPE
// STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK_SECRET (opcional, para produccion)

// ============================================================
// src/services/payment.service.js
// ============================================================
const Stripe = require('stripe');
const { supabase } = require('../config/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Crea un PaymentIntent de Stripe para una asesoria de pago
 */
const createPaymentIntent = async (userId, { session_id, amount, currency = 'mxn' }) => {
  // Verificar que la sesion existe y tiene costo
  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, cost, status, available_spots, tutor_id')
    .eq('id', session_id)
    .single();

  if (!session) throw { status: 404, message: 'Asesoria no encontrada' };
  if (session.status !== 'available') throw { status: 400, message: 'Esta asesoria no esta disponible' };
  if (session.available_spots <= 0) throw { status: 400, message: 'Sin lugares disponibles' };
  if (session.tutor_id === userId) throw { status: 400, message: 'No puedes inscribirte en tu propia asesoria' };
  if (session.cost === 0) throw { status: 400, message: 'Esta asesoria es gratuita, usa el endpoint de inscripcion directo' };

  // Verificar inscripcion previa
  const { data: existing } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('session_id', session_id)
    .eq('user_id', userId)
    .single();

  if (existing?.status === 'confirmed') throw { status: 409, message: 'Ya estas inscrito en esta asesoria' };

  // Monto en centavos (Stripe usa la unidad mas pequena de la moneda)
  const amountInCents = Math.round(session.cost * 100);

  // Crear PaymentIntent en Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      session_id,
      user_id: userId,
      session_title: session.title,
    },
    description: `TutorMatch - ${session.title}`,
  });

  // Guardar el intento de pago en la base de datos
  await supabase.from('payment_intents').insert({
    stripe_payment_intent_id: paymentIntent.id,
    user_id: userId,
    session_id,
    amount: session.cost,
    currency,
    status: 'pending',
  });

  return {
    client_secret: paymentIntent.client_secret,
    payment_intent_id: paymentIntent.id,
    amount: session.cost,
    currency,
  };
};

/**
 * Webhook de Stripe — confirma el pago y completa la inscripcion
 * Se llama automaticamente por Stripe cuando el pago es exitoso
 */
const handleWebhook = async (payload, signature) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    throw { status: 400, message: `Webhook error: ${err.message}` };
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { session_id, user_id } = paymentIntent.metadata;

    // Actualizar estado del intento de pago
    await supabase
      .from('payment_intents')
      .update({ status: 'succeeded', stripe_charge_id: paymentIntent.latest_charge })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    // Inscribir al usuario en la sesion
    const { data: session } = await supabase
      .from('sessions')
      .select('available_spots, max_spots')
      .eq('id', session_id)
      .single();

    if (session && session.available_spots > 0) {
      await supabase.from('enrollments').upsert({
        session_id,
        user_id,
        status: 'confirmed',
        payment_intent_id: paymentIntent.id,
        enrolled_at: new Date().toISOString(),
      }, { onConflict: 'session_id,user_id' });

      await supabase
        .from('sessions')
        .update({
          available_spots: session.available_spots - 1,
          status: session.available_spots - 1 === 0 ? 'full' : 'available',
        })
        .eq('id', session_id);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    await supabase
      .from('payment_intents')
      .update({ status: 'failed' })
      .eq('stripe_payment_intent_id', paymentIntent.id);
  }

  return { received: true };
};

module.exports = { createPaymentIntent, handleWebhook };
