const bcrypt = require('bcrypt');
const usuarioModel = require('../models/usuarioModel');
const { AppError } = require('../utils/errors');

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatarUsuario(usuario) {
  return {
    id: Number(usuario.id),
    nome: usuario.nome,
    email: usuario.email,
  };
}

async function cadastro(req, res, next) {
  try {
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

    if (!nome || !email || !senha) {
      throw new AppError(400, 'DADOS_INVALIDOS', 'Nome, e-mail e senha são obrigatórios.');
    }
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError(400, 'EMAIL_INVALIDO', 'Informe um endereço de e-mail válido.');
    }
    if (senha.length < 6) {
      throw new AppError(400, 'SENHA_INVALIDA', 'A senha deve ter pelo menos 6 caracteres.');
    }

    const existente = await usuarioModel.buscarPorEmail(email);
    if (existente) {
      throw new AppError(409, 'EMAIL_DUPLICADO', 'Já existe uma conta cadastrada com este e-mail.');
    }

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    const usuario = await usuarioModel.criar({
      nome,
      email: email.toLowerCase(),
      senhaHash,
    });

    req.session.usuarioId = Number(usuario.id);
    return res.status(201).json(formatarUsuario(usuario));
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError(409, 'EMAIL_DUPLICADO', 'Já existe uma conta cadastrada com este e-mail.'));
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

    if (!email || !senha) {
      throw new AppError(400, 'DADOS_INVALIDOS', 'E-mail e senha são obrigatórios.');
    }

    const usuario = await usuarioModel.buscarPorEmail(email);
    if (!usuario) {
      throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
    }

    req.session.usuarioId = Number(usuario.id);
    return res.status(200).json(formatarUsuario(usuario));
  } catch (err) {
    return next(err);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('connect.sid');
    return res.status(204).send();
  });
}

async function me(req, res, next) {
  try {
    const usuario = await usuarioModel.buscarPorId(req.session.usuarioId);
    if (!usuario) {
      throw new AppError(401, 'NAO_AUTENTICADO', 'Sessão inválida.');
    }
    return res.status(200).json(formatarUsuario(usuario));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  cadastro,
  login,
  logout,
  me,
};
