-- =============================================================================
-- Migração Arena — Novos campos em arena.inscricoes
-- Execute no SQL Editor do projeto Arena (udenzyukodbcfhyfylvq)
-- =============================================================================

-- 1. Adiciona colunas do formulário de inscrição pública
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

-- 2. Torna evento_id opcional para inscrições públicas (sem vínculo de professor)
ALTER TABLE arena.inscricoes
  ALTER COLUMN evento_id DROP NOT NULL;

-- 3. Atualiza constraint de sexo para aceitar 'outro'
ALTER TABLE arena.inscricoes
  DROP CONSTRAINT IF EXISTS inscricoes_atleta_sexo_check;
ALTER TABLE arena.inscricoes
  ADD CONSTRAINT inscricoes_atleta_sexo_check
  CHECK (atleta_sexo IN ('M', 'F', 'outro'));

-- 4. Permite inscrição pública anônima (sem professor autenticado)
DROP POLICY IF EXISTS "inscricoes: inscrição pública" ON arena.inscricoes;
CREATE POLICY "inscricoes: inscrição pública"
  ON arena.inscricoes FOR INSERT
  TO anon
  WITH CHECK (professor_id IS NULL);

-- 5. Permite leitura pública do número de protocolo
DROP POLICY IF EXISTS "inscricoes: leitura pública por numero" ON arena.inscricoes;
CREATE POLICY "inscricoes: leitura pública por numero"
  ON arena.inscricoes FOR SELECT
  TO anon
  USING (numero_inscricao IS NOT NULL);
