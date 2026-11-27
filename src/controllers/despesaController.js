const viagemModel = require('../models/viagemModel');
const despesaModel = require('../models/despesaModel');
const { AppError } = require('../utils/errors');
const { validarIdParam, validarDataISO } = require('../utils/validators');

const CATEGORIAS_VALIDAS = new Set([
  'alimentacao',
  'transporte',
  'hospedagem',
  'passeios',
  'outros',
]);

function validarPayloadDespesa(body) {
  const descricao = typeof body?.descricao === 'string' ? body.descricao.trim() : '';
  if (!descricao) {
    throw new AppError(400, 'DADOS_INVALIDOS', 'A descrição da despesa é obrigatória.');
  }

  const categoria = typeof body?.categoria === 'string' ? body.categoria.trim() : '';
  if (!CATEGORIAS_VALIDAS.has(categoria)) {
    throw new AppError(
      400,
      'CATEGORIA_INVALIDA',
      'Categoria inválida. Use: alimentacao, transporte, hospedagem, passeios ou outros.'
    );
  }

  const valorBruto = body?.valor;
  const valor = Number(valorBruto);
  if (
    valorBruto === undefined ||
    valorBruto === null ||
    valorBruto === '' ||
    Number.isNaN(valor) ||
    !Number.isFinite(valor) ||
    valor <= 0
  ) {
    throw new AppError(400, 'VALOR_INVALIDO', 'O valor da despesa deve ser maior que zero.');
  }

  let dataDespesa = null;
  if (body?.data_despesa !== undefined && body?.data_despesa !== null && body?.data_despesa !== '') {
    dataDespesa = validarDataISO(body.data_despesa, 'data_despesa');
  }

  return {
    descricao,
    categoria,
    valor: Number(valor.toFixed(2)),
    dataDespesa,
  };
}

async function listarPorViagem(req, res, next) {
  try {
    const viagemId = validarIdParam(req.params.id, 'viagem');
    const viagem = await viagemModel.buscarPorIdEUsuario(viagemId, req.session.usuarioId);
    if (!viagem) {
      throw new AppError(404, 'VIAGEM_NAO_ENCONTRADA', 'Viagem não encontrada.');
    }

    const despesas = await despesaModel.listarPorViagem(viagemId);
    return res.status(200).json(despesas);
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

    const dados = validarPayloadDespesa(req.body);
    const despesa = await despesaModel.criar({
      viagemId,
      ...dados,
    });
    return res.status(201).json(despesa);
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = validarIdParam(req.params.id, 'despesa');
    const existente = await despesaModel.buscarPorIdEUsuario(id, req.session.usuarioId);
    if (!existente) {
      throw new AppError(404, 'DESPESA_NAO_ENCONTRADA', 'Despesa não encontrada.');
    }

    const dados = validarPayloadDespesa(req.body);
    const despesa = await despesaModel.atualizar(id, dados);
    return res.status(200).json(despesa);
  } catch (err) {
    return next(err);
  }
}

async function excluir(req, res, next) {
  try {
    const id = validarIdParam(req.params.id, 'despesa');
    const excluida = await despesaModel.excluir(id, req.session.usuarioId);
    if (!excluida) {
      throw new AppError(404, 'DESPESA_NAO_ENCONTRADA', 'Despesa não encontrada.');
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

async function obterResumo(req, res, next) {
  try {
    const viagemId = validarIdParam(req.params.id, 'viagem');
    const resumo = await despesaModel.obterResumoPorViagem(viagemId, req.session.usuarioId);
    if (!resumo) {
      throw new AppError(404, 'VIAGEM_NAO_ENCONTRADA', 'Viagem não encontrada.');
    }
    return res.status(200).json(resumo);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listarPorViagem,
  criar,
  atualizar,
  excluir,
  obterResumo,
};
