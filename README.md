# TutorMatch — Backend API

REST API para la plataforma de asesorías académicas TutorMatch. Construida con Express.js y Supabase como base de datos.

---

## Stack tecnológico

- **Node.js** con **Express.js** — servidor HTTP y enrutamiento
- **Supabase** — base de datos PostgreSQL, storage y realtime
- **Socket.io** — WebSockets para chat y notificaciones en tiempo real
- **JWT** (jsonwebtoken) — autenticación con doble token
- **bcryptjs** — hash de contraseñas
- **express-validator** — validación de datos de entrada

---

## Requisitos previos

- Node.js 18 o superior
- Una cuenta en [supabase.com](https://supabase.com) con un proyecto creado
- El schema SQL ejecutado en ese proyecto (ver sección de base de datos)

---

## Instalación

```bash
# Desde la carpeta raíz del proyecto
cd TUTOR-MATCH-BACKEND

# Instalar dependencias
npm install

# Copiar el archivo de variables de entorno
cp .env.example .env
```

Edita `.env` y llena todas las variables antes de correr el servidor.

---

## Variables de entorno

```env
PORT=3000
NODE_ENV=development

# JWT — usa cadenas largas y aleatorias, mínimo 32 caracteres
JWT_SECRET=cambia_esto_por_algo_seguro
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=cambia_esto_tambien
JWT_REFRESH_EXPIRES_IN=30d

# Supabase — se obtienen en Settings > API dentro de tu proyecto
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# CORS — URLs del frontend separadas por coma
ALLOWED_ORIGINS=http://localhost:5173

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Base de datos

Antes de arrancar el servidor, el schema de la base de datos debe estar creado en Supabase.

1. Abre tu proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia el contenido de `database/schema.sql` y pégalo
5. Ejecuta con **Run** o `Ctrl + Enter`

El schema crea las siguientes tablas: `users`, `profiles`, `sessions`, `enrollments`, `reviews`, `messages`, `favorites`, `notifications`, `tips` y `subjects_catalog`. También instala los triggers, funciones, índices, políticas de Row Level Security y habilita las publicaciones de Supabase Realtime.

---

## Correr el servidor

```bash
# Desarrollo con recarga automática
npm run dev

# Producción
npm start
```

El servidor inicia en `http://localhost:3000`. Para verificar que funciona correctamente:

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "TutorMatch API",
  "version": "1.0.0"
}
```

---

## Estructura de carpetas

```
backend/
├── src/
│   ├── config/
│   │   ├── supabase.js        cliente de Supabase (service role + anon)
│   │   └── jwt.js             generacion y verificacion de tokens
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── sessions.controller.js
│   │   └── users.controller.js
│   ├── services/
│   │   ├── auth.service.js    registro, login, refresh, roles
│   │   ├── sessions.service.js asesorias, inscripciones, estados
│   │   ├── users.service.js   perfiles, tutores, historial, favoritos
│   │   ├── reviews.service.js calificaciones y rating
│   │   └── chat.service.js    conversaciones y mensajes
│   ├── middlewares/
│   │   ├── auth.middleware.js verificacion JWT y control de roles
│   │   └── error.middleware.js manejo centralizado de errores
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── sessions.routes.js
│   │   ├── users.routes.js
│   │   ├── reviews.routes.js
│   │   ├── chat.routes.js
│   │   └── admin.routes.js
│   ├── validators/
│   │   └── auth.validators.js reglas de validacion para registro y login
│   ├── utils/
│   │   └── response.js        helpers para respuestas HTTP estandarizadas
│   ├── app.js                 configuracion de Express y middlewares globales
│   └── index.js               entrada del servidor, HTTP + Socket.io
├── database/
│   └── schema.sql             schema completo para Supabase
├── .env.example
└── package.json
```

---

## Endpoints disponibles

La URL base de todos los endpoints es `/api/v1`.

### Autenticacion

| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| POST | `/auth/register` | Publico | Registrar nuevo usuario |
| POST | `/auth/login` | Publico | Iniciar sesion |
| POST | `/auth/refresh` | Publico | Renovar access token |
| GET | `/auth/me` | Autenticado | Datos del usuario actual |
| POST | `/auth/change-password` | Autenticado | Cambiar contrasena |
| POST | `/auth/add-role` | Autenticado | Agregar rol (tutor, tutee) |

### Asesorias

| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| GET | `/sessions` | Publico | Listar con filtros y paginacion |
| GET | `/sessions/:id` | Publico | Detalle de una asesoria |
| POST | `/sessions` | Rol tutor | Crear asesoria |
| POST | `/sessions/quick` | Rol tutor | Crear asesoria rapida |
| POST | `/sessions/:id/enroll` | Autenticado | Inscribirse |
| DELETE | `/sessions/:id/enroll` | Autenticado | Cancelar inscripcion |
| PATCH | `/sessions/:id/status` | Rol tutor | Cambiar estado |

### Usuarios

| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| GET | `/users/tutors` | Publico | Lista de tutores |
| GET | `/users/me` | Autenticado | Mi perfil completo |
| PATCH | `/users/me` | Autenticado | Actualizar perfil |
| GET | `/users/me/history` | Autenticado | Historial de asesorias |
| GET | `/users/me/favorites` | Autenticado | Asesorias guardadas |
| POST | `/users/me/favorites/:sessionId` | Autenticado | Guardar o quitar favorito |
| GET | `/users/:id` | Publico | Perfil publico de un usuario |

### Resenas

| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| POST | `/reviews` | Autenticado | Crear resena |
| GET | `/reviews/tutor/:tutorId` | Publico | Resenas de un tutor |

### Chat

| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| GET | `/chat` | Autenticado | Mis conversaciones |
| GET | `/chat/:conversationId` | Autenticado | Mensajes de una conversacion |
| POST | `/chat/send` | Autenticado | Enviar mensaje |

### Admin

| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| GET | `/admin/stats` | Rol admin | Estadisticas generales |
| GET | `/admin/users` | Rol admin | Lista de usuarios |
| PATCH | `/admin/users/:id/toggle` | Rol admin | Activar o desactivar cuenta |

---

## Autenticacion

Todos los endpoints protegidos requieren el header:

```
Authorization: Bearer <accessToken>
```

El access token tiene una duracion de 7 dias. Cuando expira, el servidor responde con `401` y el codigo `TOKEN_EXPIRED`. El cliente debe usar el refresh token para obtener un nuevo par de tokens:

```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJ..." }
```

---

## Roles de usuario

Un usuario puede tener multiples roles de forma simultanea. Los roles se almacenan como un arreglo en la columna `roles` de la tabla `users`.

| Rol | Permisos |
|-----|----------|
| `tutee` | Inscribirse a asesorias, dejar resenas, usar el chat |
| `tutor` | Todo lo anterior, mas crear y gestionar asesorias |
| `admin` | Acceso al panel de administracion y gestion de usuarios |

Un usuario se registra con el rol `tutee` por defecto. Puede activar el rol `tutor` en cualquier momento desde su perfil. El rol `admin` solo se puede asignar directamente en la base de datos.

---

## WebSockets con Socket.io

El servidor de WebSockets corre en el mismo puerto que el HTTP. La conexion requiere autenticacion con JWT:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'Bearer eyJ...' }
});
```

### Eventos disponibles

Eventos que el cliente envia al servidor:

| Evento | Datos | Descripcion |
|--------|-------|-------------|
| `join_conversation` | `conversationId` | Unirse a sala de chat |
| `send_message` | `{ receiver_id, conversation_id, message }` | Notificar nuevo mensaje |
| `typing` | `{ conversation_id, receiver_id }` | Indicador de escritura |
| `join_session` | `sessionId` | Suscribirse a updates de sesion |

Eventos que el servidor emite al cliente:

| Evento | Datos | Descripcion |
|--------|-------|-------------|
| `new_message` | `{ conversation_id, message }` | Mensaje recibido |
| `user_typing` | `{ conversation_id, user_id }` | Alguien esta escribiendo |
| `session_updated` | `{ session_id, status }` | Estado de sesion cambio |
| `notification` | objeto de notificacion | Notificacion del sistema |

---

## Codigos de respuesta

| Codigo | Significado |
|--------|-------------|
| 200 | Operacion exitosa |
| 201 | Recurso creado |
| 400 | Datos invalidos en la peticion |
| 401 | Token faltante, invalido o expirado |
| 403 | Sin permisos para este recurso |
| 404 | Recurso no encontrado |
| 409 | Conflicto, por ejemplo usuario ya registrado |
| 422 | Error de validacion de campos |
| 429 | Demasiadas peticiones, rate limit alcanzado |
| 500 | Error interno del servidor |

Todas las respuestas tienen el mismo formato:

```json
{
  "success": true,
  "message": "Descripcion del resultado",
  "data": {},
  "timestamp": "2026-05-28T00:00:00.000Z"
}
```

En caso de error de validacion, el campo `errors` contiene el detalle de cada campo:

```json
{
  "success": false,
  "message": "Error de validacion",
  "errors": [
    { "field": "email", "message": "Email invalido" }
  ]
}
```

---

## Notas de desarrollo

El servidor usa dos clientes de Supabase con distintos privilegios. El cliente con `service_role_key` bypasa las politicas de Row Level Security y se usa para todas las operaciones del backend. El cliente con `anon_key` respeta el RLS y se exporta para casos donde se necesite simular el acceso de un usuario no autenticado.

En modo `development`, el servidor registra todas las peticiones HTTP en consola con morgan. En `production`, este log se desactiva para reducir ruido.

El rate limiting aplica 100 peticiones por IP cada 15 minutos para rutas generales, y 10 peticiones por IP cada 15 minutos especificamente para `/auth/login` y `/auth/register` para prevenir ataques de fuerza bruta.
