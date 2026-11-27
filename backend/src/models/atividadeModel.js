const pool = require('../config/db');

const CAMPOS_ATIVIDADE = `
  id,
  viagem_id,
  titulo,
  TO_CHAR(data_atividade, 'YYYY-MM-DD') AS data_atividade,
  TO_CHAR(horario, 'HH24:MI') AS horario,
  local_atividade,
  descricao,
  concluida
`;

function formatarAtividade(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    viagem_id: Number(row.viagem_id),
    titulo: row.titulo,
    data_atividade: row.data_atividade,
    horario: row.horario ?? null,
    local_atividade: row.local_atividade ?? null,
    descricao: row.descricao ?? null,
    concluida: Boolean(row.concluida),
  };
}

async function listarPorViagem(viagemId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_ATIVIDADE}
     FROM atividades
     WHERE viagem_id = $1
     ORDER BY data_atividade ASC, horario ASC NULLS LAST, id ASC`,
    [viagemId]
  );
  return rows.map(formatarAtividade);
}

async function buscarPorIdEUsuario(atividadeId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT
       a.id,
       a.viagem_id,
       a.titulo,
       TO_CHAR(a.data_atividade, 'YYYY-MM-DD') AS data_atividade,
       TO_CHAR(a.horario, 'HH24:MI') AS horario,
       a.local_atividade,
       a.descricao,
       a.concluida,
       TO_CHAR(v.data_inicio, 'YYYY-MM-DD') AS viagem_data_inicio,
       TO_CHAR(v.data_fim, 'YYYY-MM-DD') AS viagem_data_fim
     FROM atividades a
     INNER JOIN viagens v ON v.id = a.viagem_id
     WHERE a.id = $1 AND v.usuario_id = $2`,
    [atividadeId, usuarioId]
  );
  return rows[0] || null;
}

async function criar({ viagemId, titulo, dataAtividade, horario, localAtividade, descricao }) {
  const { rows } = await pool.query(
    `INSERT INTO atividades (viagem_id, titulo, data_atividade, horario, local_atividade, descricao)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${CAMPOS_ATIVIDADE}`,
    [viagemId, titulo, dataAtividade, horario, localAtividade, descricao]
  );
  return formatarAtividade(rows[0]);
}

async function atualizar(id, { titulo, dataAtividade, horario, localAtividade, descricao }) {
  const { rows } = await pool.query(
    `UPDATE atividades
     SET titulo = $1,
         data_atividade = $2,
         horario = $3,
         local_atividade = $4,
         descricao = $5
     WHERE id = $6
     RETURNING ${CAMPOS_ATIVIDADE}`,
    [titulo, dataAtividade, horario, localAtividade, descricao, id]
  );
  return formatarAtividade(rows[0]);
}

async function atualizarConclusao(id, concluida) {
  const { rows } = await pool.query(
    `UPDATE atividades
     SET concluida = $1
     WHERE id = $2
     RETURNING ${CAMPOS_ATIVIDADE}`,
    [concluida, id]
  );
  return formatarAtividade(rows[0]);
}

async function excluir(id, usuarioId) {
  const { rowCount } = await pool.query(
    `DELETE FROM atividades a
     USING viagens v
     WHERE a.id = $1 AND a.viagem_id = v.id AND v.usuario_id = $2`,
    [id, usuarioId]
  );
  return rowCount > 0;
}

module.exports = {
  listarPorViagem,
  buscarPorIdEUsuario,
  criar,
  atualizar,
  atualizarConclusao,
  excluir,
};
