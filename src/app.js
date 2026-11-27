const path = require('path');
const express = require('express');
const session = require('express-session');
const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const viagemRoutes = require('./routes/viagemRoutes');
const atividadeRoutes = require('./routes/atividadeRoutes');
const { AppError } = require('./utils/errors');

const app = express();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tripcraft_dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24, // 24 horas
    },
  })
);

app.use(express.static(path.resolve(__dirname, '..')));

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (err) {
    return next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/viagens', viagemRoutes);
app.use('/api/atividades', atividadeRoutes);

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      erro: {
        codigo: 'ROTA_NAO_ENCONTRADA',
        mensagem: 'Rota não encontrada.',
      },
    });
  }
  return res.status(404).send('Página não encontrada.');
});

app.use((err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      erro: {
        codigo: err.codigo,
        mensagem: err.mensagem,
      },
    });
  }
  console.error(err);
  return res.status(500).json({
    erro: {
      codigo: 'ERRO_INTERNO',
      mensagem: 'Erro interno do servidor.',
    },
  });
});

module.exports = app;
