-- ============================================================
-- Arena — Schema inicial (schema isolado "arena")
-- Execute no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema isolado para não conflitar com outras tabelas do banco
CREATE SCHEMA IF NOT EXISTS arena;

-- ── Perfis de usuário ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arena.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role        TEXT NOT NULL DEFAULT 'professor'
                CHECK (role IN ('admin', 'staff', 'professor')),
  nome        TEXT NOT NULL,
  telefone    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Eventos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arena.eventos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  modalidade      TEXT NOT NULL DEFAULT 'Judô',
  descricao       TEXT,
  data_inicio     DATE NOT NULL,
  data_fim        DATE NOT NULL,
  local           TEXT NOT NULL,
  cidade          TEXT,
  uf              TEXT DEFAULT 'DF',
  status          TEXT DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho', 'aberto', 'encerrado')),
  max_inscricoes  INT,
  logo_url        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Associações ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arena.associacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   UUID NOT NULL REFERENCES arena.eventos(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cidade      TEXT,
  uf          TEXT,
  ativo       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Categorias por evento ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS arena.categorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   UUID NOT NULL REFERENCES arena.eventos(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  sexo        TEXT CHECK (sexo IN ('M', 'F', 'misto')),
  idade_min   INT,
  idade_max   INT,
  peso_min    DECIMAL(5,2),
  peso_max    DECIMAL(5,2),
  faixas      TEXT[],
  ordem       INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Professores ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arena.professores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID REFERENCES arena.profiles(id) ON DELETE SET NULL,
  associacao_id       UUID REFERENCES arena.associacoes(id),
  evento_id           UUID NOT NULL REFERENCES arena.eventos(id),
  nome                TEXT NOT NULL,
  email               TEXT NOT NULL,
  telefone            TEXT,
  graduacao           TEXT,
  invited_at          TIMESTAMPTZ,
  invite_accepted_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (email, evento_id)
);

-- ── Inscrições ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arena.inscricoes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id               UUID NOT NULL REFERENCES arena.eventos(id),
  professor_id            UUID REFERENCES arena.professores(id),
  associacao_id           UUID REFERENCES arena.associacoes(id),
  categoria_id            UUID REFERENCES arena.categorias(id),
  atleta_nome             TEXT NOT NULL,
  atleta_email            TEXT,
  atleta_telefone         TEXT,
  atleta_data_nascimento  DATE NOT NULL,
  atleta_sexo             TEXT NOT NULL CHECK (atleta_sexo IN ('M', 'F')),
  atleta_faixa            TEXT,
  atleta_peso             DECIMAL(5,2),
  status                  TEXT DEFAULT 'confirmado'
                            CHECK (status IN ('pendente', 'confirmado', 'cancelado')),
  check_in_token          UUID DEFAULT gen_random_uuid(),
  sticker_printed         BOOLEAN DEFAULT FALSE,
  sticker_printed_at      TIMESTAMPTZ,
  sticker_reprint_count   INT DEFAULT 0,
  certificado_emitido     BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── Check-ins ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arena.checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id  UUID NOT NULL REFERENCES arena.inscricoes(id) ON DELETE CASCADE UNIQUE,
  evento_id     UUID REFERENCES arena.eventos(id),
  realizado_em  TIMESTAMPTZ DEFAULT NOW(),
  validado_por  UUID REFERENCES arena.profiles(id)
);

-- ── Reimpressões (auditoria) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS arena.reimpressoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id    UUID REFERENCES arena.inscricoes(id),
  solicitado_por  UUID REFERENCES arena.profiles(id),
  justificativa   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE arena.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena.eventos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena.associacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena.categorias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena.professores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena.inscricoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena.checkins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena.reimpressoes   ENABLE ROW LEVEL SECURITY;

-- ── Helper: verifica role ─────────────────────────────────────
CREATE OR REPLACE FUNCTION arena.get_my_role()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT role FROM arena.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION arena.get_my_professor_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT p.id FROM arena.professores p
  JOIN arena.profiles pr ON pr.id = p.profile_id
  WHERE pr.user_id = auth.uid();
$$;

-- ── Profiles ──────────────────────────────────────────────────
CREATE POLICY "profiles: usuário vê próprio"
  ON arena.profiles FOR SELECT
  USING (user_id = auth.uid() OR arena.get_my_role() IN ('admin', 'staff'));

CREATE POLICY "profiles: admin gerencia"
  ON arena.profiles FOR ALL
  USING (arena.get_my_role() = 'admin');

-- ── Eventos ───────────────────────────────────────────────────
CREATE POLICY "eventos: autenticado pode ler"
  ON arena.eventos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "eventos: admin gerencia"
  ON arena.eventos FOR ALL
  USING (arena.get_my_role() = 'admin');

-- ── Associações ───────────────────────────────────────────────
CREATE POLICY "associacoes: autenticado pode ler"
  ON arena.associacoes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "associacoes: admin gerencia"
  ON arena.associacoes FOR ALL
  USING (arena.get_my_role() = 'admin');

-- ── Categorias ────────────────────────────────────────────────
CREATE POLICY "categorias: autenticado pode ler"
  ON arena.categorias FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "categorias: admin gerencia"
  ON arena.categorias FOR ALL
  USING (arena.get_my_role() = 'admin');

-- ── Professores ───────────────────────────────────────────────
CREATE POLICY "professores: professor vê próprio"
  ON arena.professores FOR SELECT
  USING (
    arena.get_my_role() IN ('admin', 'staff')
    OR profile_id = (SELECT id FROM arena.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "professores: admin gerencia"
  ON arena.professores FOR ALL
  USING (arena.get_my_role() = 'admin');

-- ── Inscrições ────────────────────────────────────────────────
CREATE POLICY "inscricoes: professor vê as suas"
  ON arena.inscricoes FOR SELECT
  USING (
    arena.get_my_role() IN ('admin', 'staff')
    OR professor_id = arena.get_my_professor_id()
  );

CREATE POLICY "inscricoes: professor insere"
  ON arena.inscricoes FOR INSERT
  WITH CHECK (professor_id = arena.get_my_professor_id());

CREATE POLICY "inscricoes: professor atualiza as suas"
  ON arena.inscricoes FOR UPDATE
  USING (professor_id = arena.get_my_professor_id());

CREATE POLICY "inscricoes: admin gerencia tudo"
  ON arena.inscricoes FOR ALL
  USING (arena.get_my_role() = 'admin');

-- ── Check-ins ─────────────────────────────────────────────────
CREATE POLICY "checkins: staff e admin"
  ON arena.checkins FOR ALL
  USING (arena.get_my_role() IN ('admin', 'staff'));

CREATE POLICY "checkins: professor vê os seus"
  ON arena.checkins FOR SELECT
  USING (
    inscricao_id IN (
      SELECT id FROM arena.inscricoes
      WHERE professor_id = arena.get_my_professor_id()
    )
  );

-- ── Expõe o schema "arena" via REST API ───────────────────────
GRANT USAGE ON SCHEMA arena TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA arena TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA arena TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA arena TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA arena
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA arena
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA arena
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
