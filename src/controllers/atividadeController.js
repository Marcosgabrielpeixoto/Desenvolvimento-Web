const viagemModel = require('../models/viagemModel');
const atividadeModel = require('../models/atividadeModel');
const { AppError } = require('../utils/errors');
const { validarIdParam, validarDataISO, validarHorario } = require('../utils/validators');

function validarPayloadAtividade(body, dataInicioViagem, dataFimViagem) {
  const titulo = typeof body?.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) {
    throw new AppError(400, 'DADOS_INVALIDOS', 'O título da atividade é obrigatório.');
  }

  const dataAtividade = validarDataISO(body?.data_atividade, 'data_atividade');
  if (dataAtividade < dataInicioViagem || dataAtividade > dataFimViagem) {
    throw new AppError(
      400,
      'ATIVIDADE_FORA_DO_PERIODO',
      'A data da atividade deve estar dentro do período da viagem.'
    );
  }

  const horario = validarHorario(body?.horario);
  const localAtividade =
    typeof body?.local_atividade === 'string' && body.local_atividade.trim() !== ''
      ? body.local_atividade.trim()
      : null;
  const descricao =
    typeof body?.descricao === 'string' && body.descricao.trim() !== ''
      ? body.descricao.trim()
      : null;

  return {
    titulo,
    dataAtividade,
    horario,
    localAtividade,
    descricao,
  };
}

async function listarPorViagem(req, res, next) {
  try {
    const viagemId = validarIdParam(req.params.id, 'viagem');
    const viagem = await viagemModel.buscarPorIdEUsuario(viagemId, req.session.usuarioId);
    if (!viagem) {
      throw new AppError(404, 'VIAGEM_NAO_ENCONTRADA', 'Viagem não encontrada.');
    }

    const atividades = await atividadeModel.listarPorViagem(viagemId);
    return res.status(200).json(atividades);
  } catch (err) {
    return next(err);
  }
}

async function criar(req, res, next) {
  try {
    const viagemId = validarIdParam(req.params.id, 'viagem');
    const viagem = await viagemModel.buscarPorIdEUsuario(viagemId, req.session.usuarioId);
    if (!viagem) {
      throw new AppError(404, 'VIAGEM_NAO_ENCONTRADA', 'Viagem não encontrada.');
    }

    const dados = validarPayloadAtividade(req.body, viagem.data_inicio, viagem.data_fim);
    const atividade = await atividadeModel.criar({
      viagemId,
      ...dados,
    });
    return res.status(201).json(atividade);
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = validarIdParam(req.params.id, 'atividade');
    const existente = await atividadeModel.buscarPorIdEUsuario(id, req.session.usuarioId);
    if (!existente) {
      throw new AppError(404, 'ATIVIDADE_NAO_ENCONTRADA', 'Atividade não encontrada.');
    }

    const dados = validarPayloadAtividade(
      req.body,
      existente.viagem_data_inicio,
      existente.viagem_data_fim
    );
    const atividade = await atividadeModel.atualizar(id, dados);
    return res.status(200).json(atividade);
  } catch (err) {
    return next(err);
  }
}

async function alterarConclusao(req, res, next) {
  try {
    const id = validarIdParam(req.params.id, 'atividade');
    if (typeof req.body?.concluida !== 'boolean') {
      throw new AppError(400, 'DADOS_INVALIDOS', 'O campo concluida deve ser booleano (true ou false).');
    }

    const existente = await atividadeModel.buscarPorIdEUsuario(id, req.session.usuarioId);
    if (!existente) {
      throw new AppError(404, 'ATIVIDADE_NAO_ENCONTRADA', 'Atividade não encontrada.');
    }

    const atividade = await atividadeModel.atualizarConclusao(id, req.body.concluida);
    return res.status(200).json(atividade);
  } catch (err) {
    return next(err);
  }
}

async function excluir(req, res, next) {
  try {
    const id = validarIdParam(req.params.id, 'atividade');
    const excluida = await atividadeModel.excluir(id, req.session.usuarioId);
    if (!excluida) {
      throw new AppError(404, 'ATIVIDADE_NAO_ENCONTRADA', 'Atividade não encontrada.');
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listarPorViagem,
  criar,
  atualizar,
  alterarConclusao,
  excluir,
};
