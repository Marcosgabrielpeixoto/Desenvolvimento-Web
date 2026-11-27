const { AppError } = require('./errors');

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarIdParam(valor, nomeRecurso = 'recurso') {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'ID_INVALIDO', `Identificador de ${nomeRecurso} inválido.`);
  }
  return id;
}

function validarDataISO(valor, nomeCampo = 'data') {
  if (typeof valor !== 'string' || !DATA_ISO_REGEX.test(valor)) {
    throw new AppError(400, 'DATA_INVALIDA', `O campo ${nomeCampo} deve estar no formato AAAA-MM-DD.`);
  }
  const [ano, mes, dia] = valor.split('-').map(Number);
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    dt.getUTCFullYear() !== ano ||
    dt.getUTCMonth() !== mes - 1 ||
    dt.getUTCDate() !== dia
  ) {
    throw new AppError(400, 'DATA_INVALIDA', `O campo ${nomeCampo} contém uma data inválida.`);
  }
  return valor;
}

function validarHorario(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  if (typeof valor !== 'string' || !HORA_REGEX.test(valor)) {
    throw new AppError(400, 'HORARIO_INVALIDO', 'O horário deve estar no formato HH:mm.');
  }
  return valor;
}

function dataAtualISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function calcularStatusViagem(dataInicio, dataFim) {
  const hoje = dataAtualISO();
  if (hoje < dataInicio) {
    return 'Planejada';
  }
  if (hoje > dataFim) {
    return 'Encerrada';
  }
  return 'Em andamento';
}

module.exports = {
  validarIdParam,
  validarDataISO,
  validarHorario,
  calcularStatusViagem,
};
