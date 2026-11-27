import { viagensApi } from './api.js';
import {
  exigirAutenticacao,
  configurarNavbarAutenticada,
  exibirAlertaInline,
  setBotaoCarregando,
  salvarFlashMessage,
} from './ui.js';

const params = new URLSearchParams(window.location.search);
const viagemIdParam = params.get('id');
const modoEdicao = Boolean(viagemIdParam);

const loadingEl = document.getElementById('form-loading');
const notFoundEl = document.getElementById('form-not-found');
const formCardEl = document.getElementById('form-card');
const alertEl = document.getElementById('viagem-form-alert');
const formEl = document.getElementById('form-viagem');

const titleEl = document.getElementById('form-title');
const subtitleEl = document.getElementById('form-subtitle');
const breadcrumbEl = document.getElementById('breadcrumb-label');
const btnCancelar = document.getElementById('btn-cancelar');
const btnSalvar = document.getElementById('btn-salvar');

const inputTitulo = document.getElementById('viagem-titulo');
const inputDestino = document.getElementById('viagem-destino');
const inputDataInicio = document.getElementById('viagem-data-inicio');
const inputDataFim = document.getElementById('viagem-data-fim');
const inputOrcamento = document.getElementById('viagem-orcamento');
const inputDescricao = document.getElementById('viagem-descricao');

inputDataInicio?.addEventListener('change', () => {
  if (inputDataInicio.value) {
    inputDataFim.min = inputDataInicio.value;
    if (inputDataFim.value && inputDataFim.value < inputDataInicio.value) {
      inputDataFim.value = inputDataInicio.value;
    }
  }
});

formEl?.addEventListener('submit', async (event) => {
  event.preventDefault();
  exibirAlertaInline(alertEl, '');

  const titulo = inputTitulo.value.trim();
  const destino = inputDestino.value.trim();
  const data_inicio = inputDataInicio.value;
  const data_fim = inputDataFim.value;
  const orcamentoStr = inputOrcamento.value.trim();
  const orcamento = Number(orcamentoStr);
  const descricao = inputDescricao.value.trim() || null;

  if (!titulo || !destino) {
    exibirAlertaInline(alertEl, 'Título e destino são obrigatórios.');
    return;
  }

  if (!data_inicio || !data_fim) {
    exibirAlertaInline(alertEl, 'Informe a data inicial e a data final da viagem.');
    return;
  }

  if (data_fim < data_inicio) {
    exibirAlertaInline(alertEl, 'A data final não pode ser anterior à data inicial.');
    return;
  }

  if (orcamentoStr === '' || Number.isNaN(orcamento) || !Number.isFinite(orcamento) || orcamento < 0) {
    exibirAlertaInline(alertEl, 'O orçamento deve ser um valor numérico maior ou igual a zero.');
    return;
  }

  const payload = {
    titulo,
    destino,
    data_inicio,
    data_fim,
    orcamento: Number(orcamento.toFixed(2)),
    descricao,
  };

  setBotaoCarregando(btnSalvar, true, modoEdicao ? 'Atualizando...' : 'Salvando...');
  try {
    if (modoEdicao) {
      const atualizada = await viagensApi.atualizar(viagemIdParam, payload);
      salvarFlashMessage('Viagem atualizada com sucesso!', 'success');
      window.location.replace(`/viagem.html?id=${atualizada.id}`);
    } else {
      const criada = await viagensApi.criar(payload);
      salvarFlashMessage('Viagem cadastrada com sucesso!', 'success');
      window.location.replace(`/viagem.html?id=${criada.id}`);
    }
  } catch (err) {
    if (err.status === 401) {
      window.location.replace('/auth.html');
      return;
    }
    exibirAlertaInline(alertEl, err.mensagem || 'Não foi possível salvar a viagem.');
    setBotaoCarregando(btnSalvar, false);
  }
});

async function initViagemForm() {
  try {
    const usuario = await exigirAutenticacao();
    if (!usuario) return;

    configurarNavbarAutenticada(usuario);

    if (!modoEdicao) {
      document.title = 'Nova viagem — TripCraft';
      return;
    }

    document.title = 'Editar viagem — TripCraft';
    titleEl.textContent = 'Editar viagem';
    subtitleEl.textContent =
      'Atualize os dados da viagem. Caso já existam atividades, o período deve continuar contemplando todas elas.';
    breadcrumbEl.textContent = 'Editar viagem';
    btnCancelar.href = `/viagem.html?id=${encodeURIComponent(viagemIdParam)}`;
    btnSalvar.innerHTML = '<i class="bi bi-check-lg me-1"></i>Salvar alterações';

    formCardEl.classList.add('d-none');
    loadingEl.classList.remove('d-none');

    const viagem = await viagensApi.buscarPorId(viagemIdParam);
    inputTitulo.value = viagem.titulo;
    inputDestino.value = viagem.destino;
    inputDataInicio.value = viagem.data_inicio;
    inputDataFim.value = viagem.data_fim;
    inputDataFim.min = viagem.data_inicio;
    inputOrcamento.value = Number(viagem.orcamento).toFixed(2);
    inputDescricao.value = viagem.descricao || '';

    loadingEl.classList.add('d-none');
    formCardEl.classList.remove('d-none');
  } catch (err) {
    loadingEl.classList.add('d-none');
    if (err.status === 404 || err.status === 400) {
      formCardEl.classList.add('d-none');
      notFoundEl.classList.remove('d-none');
      return;
    }
    formCardEl.classList.remove('d-none');
    exibirAlertaInline(alertEl, err.mensagem || 'Erro ao carregar dados da viagem.');
  }
}

initViagemForm();
