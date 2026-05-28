-- =============================================================================
-- Fix: permissão anon para inscrição pública no Festival de Judô
-- Execute no SQL Editor do projeto Arena (udenzyukodbcfhyfylvq)
-- =============================================================================

-- 1. Garante GRANT de INSERT e SELECT para o role anon
GRANT INSERT, SELECT ON arena.inscricoes TO anon;

-- 2. Torna evento_id e atleta_data_nascimento opcionais (inscrição pública)
ALTER TABLE arena.inscricoes
  ALTER COLUMN evento_id DROP NOT NULL;

ALTER TABLE arena.inscricoes
  ALTER COLUMN atleta_data_nascimento DROP NOT NULL;

-- 3. Remove QUALQUER constraint de check em atleta_sexo (nome pode variar)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'arena.inscricoes'::regclass
      AND contype = 'c'
      AND conname ILIKE '%sexo%'
  LOOP
    EXECUTE 'ALTER TABLE arena.inscricoes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 4. Recria constraint de sexo aceitando 'outro'
ALTER TABLE arena.inscricoes
  ADD CONSTRAINT inscricoes_atleta_sexo_check
  CHECK (atleta_sexo IN ('M', 'F', 'outro'));

-- 5. Adiciona colunas do formulário público (idempotente)
ALTER TABLE arena.inscricoes
  ADD COLUMN IF NOT EXISTS atleta_cpf          VARCHAR(14),
  ADD COLUMN IF NOT EXISTS atleta_rg           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS atleta_rg_orgao     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS atleta_endereco     TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_nome    TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_cpf     VARCHAR(14),
  ADD COLUMN IF NOT EXISTS responsavel_rg      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS responsavel_tel     TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_email   TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_relacao TEXT,
  ADD COLUMN IF NOT EXISTS pratica_judo        BOOLEAN,
  ADD COLUMN IF NOT EXISTS instituicao_judo    TEXT,
  ADD COLUMN IF NOT EXISTS autorizacao_aceita  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS numero_inscricao    TEXT;

-- 6. Recria políticas RLS para anon (garante idempotência)
DROP POLICY IF EXISTS "inscricoes: inscrição pública"         ON arena.inscricoes;
DROP POLICY IF EXISTS "inscricoes: leitura pública por numero" ON arena.inscricoes;

CREATE POLICY "inscricoes: inscrição pública"
  ON arena.inscricoes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "inscricoes: leitura pública por numero"
  ON arena.inscricoes FOR SELECT
  TO anon
  USING (numero_inscricao IS NOT NULL);

-- 7. Confirma que RLS está ativo na tabela
ALTER TABLE arena.inscricoes ENABLE ROW LEVEL SECURITY;
