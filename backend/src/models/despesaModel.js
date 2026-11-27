const pool = require('../config/db');

const CAMPOS_DESPESA = `
  id,
  viagem_id,
  descricao,
  categoria,
  valor,
  TO_CHAR(data_despesa, 'YYYY-MM-DD') AS data_despesa
`;

function formatarDespesa(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    viagem_id: Number(row.viagem_id),
    descricao: row.descricao,
    categoria: row.categoria,
    valor: Number(row.valor),
    data_despesa: row.data_despesa,
  };
}

async function listarPorViagem(viagemId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_DESPESA}
     FROM despesas
     WHERE viagem_id = $1
     ORDER BY data_despesa DESC, id DESC`,
    [viagemId]
  );
  return rows.map(formatarDespesa);
}

async function buscarPorIdEUsuario(despesaId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.viagem_id,
       d.descricao,
       d.categoria,
       d.valor,
       TO_CHAR(d.data_despesa, 'YYYY-MM-DD') AS data_despesa
     FROM despesas d
     INNER JOIN viagens v ON v.id = d.viagem_id
     WHERE d.id = $1 AND v.usuario_id = $2`,
    [despesaId, usuarioId]
  );
  return formatarDespesa(rows[0]);
}

async function criar({ viagemId, descricao, categoria, valor, dataDespesa }) {
  const { rows } = await pool.query(
    `INSERT INTO despesas (viagem_id, descricao, categoria, valor, data_despesa)
     VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE))
     RETURNING ${CAMPOS_DESPESA}`,
    [viagemId, descricao, categoria, valor, dataDespesa]
  );
  return formatarDespesa(rows[0]);
}

async function atualizar(id, { descricao, categoria, valor, dataDespesa }) {
  const { rows } = await pool.query(
    `UPDATE despesas
     SET descricao = $1,
         categoria = $2,
         valor = $3,
         data_despesa = COALESCE($4::date, data_despesa)
     WHERE id = $5
     RETURNING ${CAMPOS_DESPESA}`,
    [descricao, categoria, valor, dataDespesa, id]
  );
  return formatarDespesa(rows[0]);
}

async function excluir(id, usuarioId) {
  const { rowCount } = await pool.query(
    `DELETE FROM despesas d
     USING viagens v
     WHERE d.id = $1 AND d.viagem_id = v.id AND v.usuario_id = $2`,
    [id, usuarioId]
  );
  return rowCount > 0;
}

async function obterResumoPorViagem(viagemId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT
       v.id,
       v.orcamento,
       COALESCE(SUM(d.valor), 0) AS total_gasto,
       v.orcamento - COALESCE(SUM(d.valor), 0) AS saldo_disponivel
     FROM viagens v
     LEFT JOIN despesas d ON d.viagem_id = v.id
     WHERE v.id = $1 AND v.usuario_id = $2
     GROUP BY v.id, v.orcamento`,
    [viagemId, usuarioId]
  );

  if (!rows[0]) return null;
  return {
    id: Number(rows[0].id),
    orcamento: Number(rows[0].orcamento),
    total_gasto: Number(rows[0].total_gasto),
    saldo_disponivel: Number(rows[0].saldo_disponivel),
  };
}

module.exports = {
  listarPorViagem,
  buscarPorIdEUsuario,
  criar,
  atualizar,
  excluir,
  obterResumoPorViagem,
};
