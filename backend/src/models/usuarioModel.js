const pool = require('../config/db');

async function buscarPorEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, nome, email, senha_hash FROM usuarios WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await pool.query(
    'SELECT id, nome, email FROM usuarios WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function criar({ nome, email, senhaHash }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash)
     VALUES ($1, $2, $3)
     RETURNING id, nome, email`,
    [nome, email, senhaHash]
  );
  return rows[0];
}

module.exports = {
  buscarPorEmail,
  buscarPorId,
  criar,
};
