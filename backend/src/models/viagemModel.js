const pool = require('../config/db');
const { calcularStatusViagem } = require('../utils/validators');

const CAMPOS_VIAGEM = `
  id,
  usuario_id,
  titulo,
  destino,
  TO_CHAR(data_inicio, 'YYYY-MM-DD') AS data_inicio,
  TO_CHAR(data_fim, 'YYYY-MM-DD') AS data_fim,
  orcamento,
  descricao
`;

function formatarViagem(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    titulo: row.titulo,
    destino: row.destino,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
    orcamento: Number(row.orcamento),
    descricao: row.descricao ?? null,
    status: calcularStatusViagem(row.data_inicio, row.data_fim),
  };
}

async function listarPorUsuario(usuarioId, busca) {
  if (busca) {
    const termo = `%${busca}%`;
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_VIAGEM}
       FROM viagens
       WHERE usuario_id = $1
         AND (titulo ILIKE $2 OR destino ILIKE $2)
       ORDER BY data_inicio ASC, id DESC`,
      [usuarioId, termo]
    );
    return rows.map(formatarViagem);
  }

  const { rows } = await pool.query(
    `SELECT ${CAMPOS_VIAGEM}
     FROM viagens
     WHERE usuario_id = $1
     ORDER BY data_inicio ASC, id DESC`,
    [usuarioId]
  );
  return rows.map(formatarViagem);
}

async function buscarPorIdEUsuario(id, usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_VIAGEM}
     FROM viagens
     WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId]
  );
  return formatarViagem(rows[0]);
}

async function criar({ usuarioId, titulo, destino, dataInicio, dataFim, orcamento, descricao }) {
  const { rows } = await pool.query(
    `INSERT INTO viagens (usuario_id, titulo, destino, data_inicio, data_fim, orcamento, descricao)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${CAMPOS_VIAGEM}`,
    [usuarioId, titulo, destino, dataInicio, dataFim, orcamento, descricao]
  );
  return formatarViagem(rows[0]);
}

async function contarAtividadesForaDoPeriodo(viagemId, dataInicio, dataFim) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM atividades
     WHERE viagem_id = $1
       AND (data_atividade < $2 OR data_atividade > $3)`,
    [viagemId, dataInicio, dataFim]
  );
  return rows[0].total;
}

async function atualizar(id, usuarioId, { titulo, destino, dataInicio, dataFim, orcamento, descricao }) {
  const { rows } = await pool.query(
    `UPDATE viagens
     SET titulo = $1,
         destino = $2,
         data_inicio = $3,
         data_fim = $4,
         orcamento = $5,
         descricao = $6
     WHERE id = $7 AND usuario_id = $8
     RETURNING ${CAMPOS_VIAGEM}`,
    [titulo, destino, dataInicio, dataFim, orcamento, descricao, id, usuarioId]
  );
  return formatarViagem(rows[0]);
}

async function excluir(id, usuarioId) {
  const { rowCount } = await pool.query(
    'DELETE FROM viagens WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
  return rowCount > 0;
}

module.exports = {
  listarPorUsuario,
  buscarPorIdEUsuario,
  criar,
  contarAtividadesForaDoPeriodo,
  atualizar,
  excluir,
};
