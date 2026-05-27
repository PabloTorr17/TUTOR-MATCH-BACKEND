# TutorMatch - Arquitectura y Guía de Configuración

## Stack Tecnológico Final

### Backend
- **Express.js** — API REST ligera y flexible, ideal para proyectos universitarios
- **Socket.io** — Tiempo real para chat y notificaciones
- **Supabase JS SDK** — Cliente para PostgreSQL + Auth + Storage + Realtime
- **JWT (jsonwebtoken + bcryptjs)** — Autenticación manual con doble token
- **express-validator** — Validación de datos

> **¿Por qué Express sobre NestJS/FastAPI?**
> Express tiene menor curva de aprendizaje, es más rápido de prototipar y más que suficiente para un proyecto universitario. NestJS sería ideal si el equipo ya conoce Angular/TypeScript.

### Base de Datos
- **Supabase PostgreSQL** — Base de datos relacional gestionada
- **Supabase Realtime** — Cambios en tiempo real vía WebSockets
- **Supabase Storage** — Almacenamiento de fotos y archivos

### Frontend Web
- **React + Vite** — Rápido, moderno, ecosistema enorme
- **TailwindCSS** — Estilos utilitarios
- **Supabase JS** — Realtime directo al cliente

### App Móvil
- **Flutter** — Una sola base de código para iOS y Android
- **Supabase Flutter SDK** — Cliente oficial

---

## Estructura de Carpetas del Proyecto Completo

```
tutormatch/
├── backend/                    ← API REST + Socket.io
│   ├── src/
│   │   ├── config/
│   │   │   ├── supabase.js    ← Cliente Supabase
│   │   │   └── jwt.js         ← Configuración JWT
│   │   ├── controllers/       ← Reciben req/res, llaman services
│   │   │   ├── auth.controller.js
│   │   │   ├── sessions.controller.js
│   │   │   └── users.controller.js
│   │   ├── services/          ← Lógica de negocio pura
│   │   │   ├── auth.service.js
│   │   │   ├── sessions.service.js
│   │   │   ├── users.service.js
│   │   │   ├── reviews.service.js
│   │   │   └── chat.service.js
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js  ← JWT verify + roles
│   │   │   └── error.middleware.js ← Global error handler
│   │   ├── routes/            ← Definición de endpoints
│   │   │   ├── auth.routes.js
│   │   │   ├── sessions.routes.js
│   │   │   ├── users.routes.js
│   │   │   ├── reviews.routes.js
│   │   │   ├── chat.routes.js
│   │   │   └── admin.routes.js
│   │   ├── validators/        ← Reglas de express-validator
│   │   │   └── auth.validators.js
│   │   ├── utils/
│   │   │   └── response.js    ← Helpers de respuestas HTTP
│   │   ├── app.js             ← Express app + middlewares
│   │   └── index.js           ← Servidor HTTP + Socket.io
│   ├── .env.example
│   └── package.json
│
├── database/
│   └── schema.sql             ← Esquema completo de Supabase
│
├── frontend-web/              ← React + Vite (próximo paso)
│   ├── src/
│   │   ├── api/               ← Clientes HTTP (axios)
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/             ← Estado global (Zustand/Redux)
│   │   ├── hooks/
│   │   └── lib/
│   │       └── supabase.js    ← Cliente Supabase para realtime
│   └── package.json
│
├── mobile/                    ← Flutter App (próximo paso)
│   ├── lib/
│   │   ├── core/
│   │   │   ├── api/           ← Cliente HTTP (dio)
│   │   │   └── supabase/      ← Supabase Flutter
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── sessions/
│   │   │   ├── profile/
│   │   │   └── chat/
│   │   └── main.dart
│   └── pubspec.yaml
│
└── docs/
    └── API.md                 ← Documentación de endpoints
```

---

## Configuración Inicial

### 1. Crear proyecto en Supabase
1. Ir a [supabase.com](https://supabase.com) → New Project
2. Guardar: **URL**, **anon key**, **service_role key**
3. Ir a SQL Editor → Pegar `database/schema.sql` → Run

### 2. Configurar Backend
```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales de Supabase
npm install
npm run dev
```

### 3. Verificar instalación
```bash
curl http://localhost:3000/health
# {"status":"ok","service":"TutorMatch API",...}
```

### 4. Probar registro
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@universidad.edu",
    "password": "Test1234",
    "full_name": "Usuario Test",
    "career": "Sistemas",
    "semester": 4
  }'
```

---

## Flujo de Autenticación

```
Usuario                Backend              Supabase DB
   |                      |                     |
   |-- POST /auth/register ->|                   |
   |                      |-- INSERT users ----->|
   |                      |<-- user data --------|
   |                      |-- INSERT profiles -->|
   |<-- {user, tokens} ---|                      |
   |                      |                     |
   |-- POST /auth/login -->|                     |
   |                      |-- SELECT + bcrypt -->|
   |<-- {user, tokens} ---|                      |
   |                      |                     |
   |-- GET /sessions      |                     |
   |   Authorization: Bearer <accessToken>       |
   |                      |-- Verify JWT ------->|
   |                      |-- SELECT sessions -->|
   |<-- sessions[] -------|                      |
   |                      |                     |
   | (accessToken expira) |                     |
   |-- POST /auth/refresh  |                    |
   |   {refreshToken}      |                    |
   |<-- {nuevos tokens}---|                      |
```

---

## División del Trabajo Sugerida

### Equipo de 3 personas:

**Persona 1 - Backend Developer**
- Configurar Supabase y ejecutar schema.sql
- Configurar variables de entorno
- Completar servicios faltantes (tips, notificaciones push)
- Testing de endpoints con Postman/Thunder Client

**Persona 2 - Frontend Web (React)**
- Pantallas: Login, Registro, Home (lista sesiones), Detalle sesión
- Pantallas: Mi perfil, Crear asesoría, Mis inscripciones
- Integración con Socket.io para chat
- Supabase Realtime para updates de sesiones

**Persona 3 - Mobile (Flutter)**
- Mismas pantallas que web pero en Flutter
- Notificaciones push con FCM
- Mapa con Google Maps Flutter (sesiones presenciales)
- Chat en tiempo real con Supabase Realtime

### Workflow de Git
```
main (producción)
  └── develop
        ├── feature/backend-auth
        ├── feature/web-sessions
        └── feature/mobile-chat
```

---

## Endpoints por Módulo

| Módulo | Endpoints |
|--------|-----------|
| Auth | register, login, refresh, me, change-password, add-role |
| Sessions | list, detail, create, quick, enroll, unenroll, status |
| Users | profile, update, tutors, history, favorites |
| Reviews | create, list-by-tutor |
| Chat | conversations, messages, send |
| Admin | stats, users, toggle |

**Total: ~25 endpoints REST + WebSocket bidireccional**

---

## Próximos Pasos

1. ✅ **Backend básico** (este entregable)
2. 🔜 **Frontend Web** — React + Vite con todas las pantallas
3. 🔜 **App Flutter** — Pantallas móviles
4. 🔜 **Notificaciones Push** — FCM para Flutter
5. 🔜 **Upload de fotos** — Supabase Storage
6. 🔜 **Panel Admin** — Dashboard con estadísticas
7. 🔜 **Sistema de propinas** — Simulación de pagos
