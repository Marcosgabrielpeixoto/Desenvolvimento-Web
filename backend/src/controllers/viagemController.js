const viagemModel = require('../models/viagemModel');
const { AppError } = require('../utils/errors');
const { validarIdParam, validarDataISO } = require('../utils/validators');

function validarPayloadViagem(body) {
  const titulo = typeof body?.titulo === 'string' ? body.titulo.trim() : '';
  const destino = typeof body?.destino === 'string' ? body.destino.trim() : '';
  const descricao =
    typeof body?.descricao === 'string' && body.descricao.trim() !== ''
      ? body.descricao.trim()
      : null;

  if (!titulo || !destino) {
    throw new AppError(400, 'DADOS_INVALIDOS', 'Título e destino são obrigatórios.');
  }

  const dataInicio = validarDataISO(body?.data_inicio, 'data_inicio');
  const dataFim = validarDataISO(body?.data_fim, 'data_fim');

  if (dataFim < dataInicio) {
    throw new AppError(400, 'DATAS_INVALIDAS', 'A data final não pode ser anterior à inicial.');
  }

  const orcamentoBruto = body?.orcamento;
  const orcamento = Number(orcamentoBruto);
  if (
    orcamentoBruto === undefined ||
    orcamentoBruto === null ||
    orcamentoBruto === '' ||
    Number.isNaN(orcamento) ||
    !Number.isFinite(orcamento) ||
    orcamento < 0
  ) {
    throw new AppError(400, 'ORCAMENTO_INVALIDO', 'O orçamento deve ser um número maior ou igual a zero.');
  }

  return {
    titulo,
    destino,
    dataInicio,
    dataFim,
    orcamento: Number(orcamento.toFixed(2)),
    descricao,
  };
}

async function listar(req, res, next) {
  try {
    const busca = typeof req.query?.busca === 'string' ? req.query.busca.trim() : '';
    const viagens = await viagemModel.listarPorUsuario(req.session.usuarioId, busca);
    return res.status(200).json(viagens);
  } catch (err) {
    return next(err);
  }
}

async function criar(req, res, next) {
  try {
    const dados = validarPayloadViagem(req.body);
    const viagem = await viagemModel.criar({
      usuarioId: req.session.usuarioId,
      ...dados,
    });
    return res.status(201).json(viagem);
  } catch (err) {
    return next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const id = validarIdParam(req.params.id, 'viagem');
    const viagem = await viagemModel.buscarPorIdEUsuario(id, req.session.usuarioId);
    if (!viagem) {
      throw new AppError(404, 'VIAGEM_NAO_ENCONTRADA', 'Viagem não encontrada.');
    }
    return res.status(200).json(viagem);
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = validarIdParam(req.params.id, 'viagem');
    const existente = await viagemModel.buscarPorIdEUsuario(id, req.session.usuarioId);
    if (!existente) {
      throw new AppError(404, 'VIAGEM_NAO_ENCONTRADA', 'Viagem não encontrada.');
    }

    const dados = validarPayloadViagem(req.body);
    const atividadesFora = await viagemModel.contarAtividadesForaDoPeriodo(
      id,
      dados.dataInicio,
      dados.dataFim
    );
    if (atividadesFora > 0) {
      throw new AppError(
        409,
        'CONFLITO_DATAS_ATIVIDADES',
        'Existem atividades cadastradas fora do novo período da viagem.'
      );
    }

    const viagem = await viagemModel.atualizar(id, req.session.usuarioId, dados);
    return res.status(200).json(viagem);
  } catch (err) {
    return next(err);
  }
}

async function excluir(req, res, next) {
  try {
    const id = validarIdParam(req.params.id, 'viagem');
    const excluida = await viagemModel.excluir(id, req.session.usuarioId);
    if (!excluida) {
      throw new AppError(404, 'VIAGEM_NAO_ENCONTRADA', 'Viagem não encontrada.');
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listar,
  criar,
  buscarPorId,
  atualizar,
  excluir,
};
