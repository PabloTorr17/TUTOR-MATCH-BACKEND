-- ================================================================
-- TutorMatch - Esquema completo de base de datos para Supabase
-- ================================================================
-- Ejecutar en Supabase SQL Editor en este orden exacto
-- ================================================================

-- ================================================================
-- EXTENSIONES
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda de texto

-- ================================================================
-- ENUMS (tipos personalizados)
-- ================================================================

-- Modalidad de la asesoría
CREATE TYPE session_modality AS ENUM ('presential', 'virtual');

-- Estado de la asesoría
CREATE TYPE session_status AS ENUM ('available', 'full', 'in_progress', 'completed', 'cancelled');

-- Tipo de asesoría
CREATE TYPE session_type AS ENUM ('individual', 'group', 'quick', 'scheduled');

-- Dificultad
CREATE TYPE difficulty_level AS ENUM ('basic', 'intermediate', 'advanced', 'any');

-- Estado de inscripción
CREATE TYPE enrollment_status AS ENUM ('confirmed', 'cancelled', 'attended', 'no_show');

-- Tipo de mensaje
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'link');

-- Roles de usuario
CREATE TYPE user_role AS ENUM ('tutor', 'tutee', 'admin');

-- ================================================================
-- TABLA: users
-- ================================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  career        TEXT NOT NULL,
  semester      SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 12),
  roles         TEXT[] NOT NULL DEFAULT ARRAY['tutee'],
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_roles ON public.users USING GIN(roles);
CREATE INDEX idx_users_career ON public.users(career);
CREATE INDEX idx_users_is_active ON public.users(is_active);

-- ================================================================
-- TABLA: profiles
-- Extiende users con información de perfil académico
-- ================================================================
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  bio             TEXT DEFAULT '',
  subjects        TEXT[] DEFAULT ARRAY[]::TEXT[],       -- Materias que domina/necesita
  rating          NUMERIC(3,2) DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  total_sessions  INTEGER DEFAULT 0 CHECK (total_sessions >= 0),
  attendance_rate NUMERIC(5,2) DEFAULT 100 CHECK (attendance_rate BETWEEN 0 AND 100),
  availability    JSONB DEFAULT '{}',                   -- Horarios disponibles
  badges          TEXT[] DEFAULT ARRAY[]::TEXT[],       -- Logros/badges
  social_links    JSONB DEFAULT '{}',                   -- { linkedin, github, etc }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_rating ON public.profiles(rating DESC);
CREATE INDEX idx_profiles_subjects ON public.profiles USING GIN(subjects);

-- ================================================================
-- TABLA: sessions (asesorías)
-- ================================================================
CREATE TABLE public.sessions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  subject          TEXT NOT NULL,
  description      TEXT DEFAULT '',
  modality         session_modality NOT NULL,
  location         TEXT,                                -- Si es presencial
  meet_link        TEXT,                                -- Si es virtual
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 480),
  max_spots        SMALLINT NOT NULL DEFAULT 1 CHECK (max_spots BETWEEN 1 AND 30),
  available_spots  SMALLINT NOT NULL DEFAULT 1,
  cost             NUMERIC(10,2) DEFAULT 0 CHECK (cost >= 0),
  difficulty       difficulty_level DEFAULT 'intermediate',
  session_type     session_type DEFAULT 'scheduled',
  tags             TEXT[] DEFAULT ARRAY[]::TEXT[],
  status           session_status DEFAULT 'available',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validaciones
  CONSTRAINT check_virtual_needs_link CHECK (
    modality = 'presential' OR (modality = 'virtual' AND meet_link IS NOT NULL)
  ),
  CONSTRAINT check_presential_needs_location CHECK (
    modality = 'virtual' OR (modality = 'presential' AND location IS NOT NULL)
  ),
  CONSTRAINT check_spots_not_exceed_max CHECK (
    available_spots <= max_spots
  )
);

-- Índices para sessions
CREATE INDEX idx_sessions_tutor_id ON public.sessions(tutor_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_sessions_subject ON public.sessions(subject);
CREATE INDEX idx_sessions_scheduled_at ON public.sessions(scheduled_at);
CREATE INDEX idx_sessions_modality ON public.sessions(modality);
CREATE INDEX idx_sessions_session_type ON public.sessions(session_type);
CREATE INDEX idx_sessions_cost ON public.sessions(cost);
-- Índice de búsqueda de texto completo
CREATE INDEX idx_sessions_search ON public.sessions USING GIN(
  to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(description, ''))
);

-- ================================================================
-- TABLA: enrollments (inscripciones a asesorías)
-- ================================================================
CREATE TABLE public.enrollments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      enrollment_status NOT NULL DEFAULT 'confirmed',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un usuario solo puede tener una inscripción activa por sesión
  UNIQUE(session_id, user_id)
);

-- Índices para enrollments
CREATE INDEX idx_enrollments_session_id ON public.enrollments(session_id);
CREATE INDEX idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX idx_enrollments_status ON public.enrollments(status);

-- ================================================================
-- TABLA: reviews (calificaciones)
-- ================================================================
CREATE TABLE public.reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  reviewer_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewed_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Solo una reseña por usuario por sesión
  UNIQUE(session_id, reviewer_id),
  -- No puedes calificarte a ti mismo
  CONSTRAINT check_no_self_review CHECK (reviewer_id != reviewed_id)
);

-- Índices para reviews
CREATE INDEX idx_reviews_session_id ON public.reviews(session_id);
CREATE INDEX idx_reviews_reviewed_id ON public.reviews(reviewed_id);
CREATE INDEX idx_reviews_reviewer_id ON public.reviews(reviewer_id);

-- ================================================================
-- TABLA: messages (chat en tiempo real)
-- ================================================================
CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id TEXT NOT NULL,               -- ID determinístico: sorted(user1_id, user2_id)
  sender_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  message_type    message_type DEFAULT 'text',
  file_url        TEXT,                        -- Para imágenes y archivos
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_no_self_message CHECK (sender_id != receiver_id)
);

-- Índices para messages
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_unread ON public.messages(receiver_id, read_at) WHERE read_at IS NULL;

-- ================================================================
-- TABLA: favorites (asesorías guardadas)
-- ================================================================
CREATE TABLE public.favorites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, session_id)
);

CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);

-- ================================================================
-- TABLA: notifications
-- ================================================================
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,          -- 'new_enrollment', 'session_reminder', 'new_message', etc
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB DEFAULT '{}',     -- Datos adicionales (session_id, etc)
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- ================================================================
-- TABLA: tips (propinas - simuladas)
-- ================================================================
CREATE TABLE public.tips (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  from_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  message    TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tips_session_id ON public.tips(session_id);
CREATE INDEX idx_tips_to_id ON public.tips(to_id);

-- ================================================================
-- FUNCIONES Y TRIGGERS
-- ================================================================

-- Función: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- Función: crear perfil automáticamente al crear usuario
-- ================================================================
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_profile
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_for_user();

-- ================================================================
-- Función: actualizar contador de sesiones y rating del tutor
-- ================================================================
CREATE OR REPLACE FUNCTION update_tutor_stats()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating NUMERIC(3,2);
  session_count INTEGER;
BEGIN
  -- Solo cuando una sesión se marca como completada
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Calcular promedio de rating
    SELECT COALESCE(AVG(rating), 0) INTO avg_rating
    FROM public.reviews
    WHERE reviewed_id = NEW.tutor_id;

    -- Contar sesiones completadas
    SELECT COUNT(*) INTO session_count
    FROM public.sessions
    WHERE tutor_id = NEW.tutor_id AND status = 'completed';

    -- Actualizar perfil del tutor
    UPDATE public.profiles
    SET
      rating = ROUND(avg_rating::numeric, 2),
      total_sessions = session_count
    WHERE user_id = NEW.tutor_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tutor_stats
  AFTER UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_tutor_stats();

-- ================================================================
-- Función: crear notificación al inscribirse en una sesión
-- ================================================================
CREATE OR REPLACE FUNCTION notify_tutor_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  student_name TEXT;
  session_title TEXT;
  tutor_id UUID;
BEGIN
  IF NEW.status = 'confirmed' THEN
    -- Obtener datos necesarios
    SELECT u.full_name INTO student_name FROM public.users u WHERE u.id = NEW.user_id;
    SELECT s.title, s.tutor_id INTO session_title, tutor_id
    FROM public.sessions s WHERE s.id = NEW.session_id;

    -- Crear notificación para el tutor
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      tutor_id,
      'new_enrollment',
      'Nuevo inscrito en tu asesoría',
      student_name || ' se unió a "' || session_title || '"',
      jsonb_build_object('session_id', NEW.session_id, 'student_id', NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_on_enrollment
  AFTER INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION notify_tutor_on_enrollment();

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- NOTA: Nuestro backend usa service_role_key que bypasa RLS.
-- Las políticas de abajo son para acceso directo desde clientes
-- (ej: Supabase Realtime subscriptions desde Flutter/React)

-- Políticas para users: cualquiera puede ver perfiles públicos
CREATE POLICY "Usuarios públicos visibles" ON public.users
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Usuario puede actualizar su propio perfil" ON public.users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Políticas para sessions: lectura pública, escritura solo autenticados
CREATE POLICY "Sesiones visibles para todos" ON public.sessions
  FOR SELECT USING (TRUE);

CREATE POLICY "Solo tutores pueden crear sesiones" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid()::text = tutor_id::text);

CREATE POLICY "Solo el tutor puede modificar su sesión" ON public.sessions
  FOR UPDATE USING (auth.uid()::text = tutor_id::text);

-- Políticas para messages: solo participantes de la conversación
CREATE POLICY "Solo participantes ven mensajes" ON public.messages
  FOR SELECT USING (
    auth.uid()::text = sender_id::text OR
    auth.uid()::text = receiver_id::text
  );

CREATE POLICY "Usuario puede enviar mensajes" ON public.messages
  FOR INSERT WITH CHECK (auth.uid()::text = sender_id::text);

-- Políticas para notifications: solo el dueño las ve
CREATE POLICY "Usuario ve sus propias notificaciones" ON public.notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Usuario puede marcar sus notificaciones como leídas" ON public.notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- ================================================================
-- SUPABASE REALTIME
-- Habilitar publicaciones para tiempo real
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;

-- ================================================================
-- DATOS INICIALES (Seeds de ejemplo para desarrollo)
-- ================================================================

-- Usuario administrador de prueba
-- Contraseña: Admin1234 (hash bcrypt)
INSERT INTO public.users (id, email, password_hash, full_name, career, semester, roles)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@tutormatch.edu',
  '$2a$12$placeholder_hash_change_this',
  'Administrador TutorMatch',
  'Sistemas Computacionales',
  8,
  ARRAY['admin', 'tutor', 'tutee']
) ON CONFLICT DO NOTHING;

-- Materias de ejemplo más comunes
-- (Se usan para sugerencias en el frontend)
CREATE TABLE IF NOT EXISTS public.subjects_catalog (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  area TEXT
);

INSERT INTO public.subjects_catalog (name, area) VALUES
  ('Cálculo Diferencial', 'Matemáticas'),
  ('Cálculo Integral', 'Matemáticas'),
  ('Álgebra Lineal', 'Matemáticas'),
  ('Probabilidad y Estadística', 'Matemáticas'),
  ('Programación Orientada a Objetos', 'Sistemas'),
  ('Estructuras de Datos', 'Sistemas'),
  ('Bases de Datos', 'Sistemas'),
  ('Algoritmos y Complejidad', 'Sistemas'),
  ('Redes de Computadoras', 'Sistemas'),
  ('Sistemas Operativos', 'Sistemas'),
  ('Desarrollo Web', 'Sistemas'),
  ('Inteligencia Artificial', 'Sistemas'),
  ('Física I', 'Ciencias Básicas'),
  ('Física II', 'Ciencias Básicas'),
  ('Química General', 'Ciencias Básicas'),
  ('Inglés Técnico', 'Idiomas'),
  ('Ética Profesional', 'Humanidades'),
  ('Administración de Proyectos', 'Gestión')
ON CONFLICT DO NOTHING;

-- ================================================================
-- VISTAS ÚTILES
-- ================================================================

-- Vista: sesiones con info completa del tutor y estadísticas
CREATE OR REPLACE VIEW public.sessions_with_details AS
SELECT
  s.*,
  u.full_name AS tutor_name,
  u.avatar_url AS tutor_avatar,
  u.career AS tutor_career,
  p.rating AS tutor_rating,
  p.total_sessions AS tutor_total_sessions,
  (SELECT COUNT(*) FROM public.enrollments e
   WHERE e.session_id = s.id AND e.status = 'confirmed') AS enrolled_count
FROM public.sessions s
JOIN public.users u ON u.id = s.tutor_id
LEFT JOIN public.profiles p ON p.user_id = s.tutor_id;

-- Vista: estadísticas por materia
CREATE OR REPLACE VIEW public.subject_stats AS
SELECT
  subject,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_sessions,
  AVG(cost) AS avg_cost,
  SUM(max_spots - available_spots) AS total_enrollments
FROM public.sessions
GROUP BY subject
ORDER BY total_sessions DESC;

-- ================================================================
-- FIN DEL ESQUEMA
-- ================================================================
-- Para ejecutar este archivo en Supabase:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Abre el SQL Editor
-- 3. Pega este contenido y ejecuta
-- ================================================================
