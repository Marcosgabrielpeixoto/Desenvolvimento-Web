CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Evita emails duplicados sem diferenciar maiúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email
ON usuarios (LOWER(email));

CREATE TABLE IF NOT EXISTS viagens (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  destino VARCHAR(150) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  orcamento NUMERIC(12,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_viagem_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_datas_viagem
    CHECK (data_fim >= data_inicio),
  CONSTRAINT chk_orcamento
    CHECK (orcamento >= 0)
);

CREATE TABLE IF NOT EXISTS atividades (
  id BIGSERIAL PRIMARY KEY,
  viagem_id BIGINT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  data_atividade DATE NOT NULL,
  horario TIME,
  local_atividade VARCHAR(150),
  descricao TEXT,
  concluida BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_atividade_viagem
    FOREIGN KEY (viagem_id)
    REFERENCES viagens(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS despesas (
  id BIGSERIAL PRIMARY KEY,
  viagem_id BIGINT NOT NULL,
  descricao VARCHAR(150) NOT NULL,
  categoria VARCHAR(30) NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_despesa DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT fk_despesa_viagem
    FOREIGN KEY (viagem_id)
    REFERENCES viagens(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_valor_despesa
    CHECK (valor > 0),
  CONSTRAINT chk_categoria_despesa
    CHECK (categoria IN (
      'alimentacao',
      'transporte',
      'hospedagem',
      'passeios',
      'outros'
    ))
);

CREATE INDEX IF NOT EXISTS idx_viagens_usuario
ON viagens(usuario_id);

CREATE INDEX IF NOT EXISTS idx_atividades_viagem_data
ON atividades(viagem_id, data_atividade);

CREATE INDEX IF NOT EXISTS idx_despesas_viagem
ON despesas(viagem_id);
