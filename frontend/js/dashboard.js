import { viagensApi } from './api.js';
import {
  exigirAutenticacao,
  configurarNavbarAutenticada,
  escapeHtml,
  formatarMoeda,
  formatarDataBR,
  calcularDuracaoDias,
  renderStatusBadge,
  confirmarAcao,
  showToast,
  exibirAlertaInline,
  obterFlashMessage,
} from './ui.js';

let todasViagens = [];
let filtroStatus = 'todas';
let termoBuscaAtual = '';
let debounceTimer = null;

const loadingEl = document.getElementById('dashboard-loading');
const gridEl = document.getElementById('viagens-grid');
const emptyEl = document.getElementById('viagens-empty');
const emptyTitleEl = document.getElementById('empty-title');
const emptyDescEl = document.getElementById('empty-description');
const emptyCtaEl = document.getElementById('empty-cta');
const alertEl = document.getElementById('dashboard-alert');
const formBusca = document.getElementById('form-busca');
const inputBusca = document.getElementById('input-busca');
const btnLimparBusca = document.getElementById('btn-limpar-busca');

function atualizarIndicadores(lista) {
  const total = lista.length;
  const planejadas = lista.filter((v) => v.status === 'Planejada').length;
  const andamento = lista.filter((v) => v.status === 'Em andamento').length;
  const encerradas = lista.filter((v) => v.status === 'Encerrada').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-planejadas').textContent = planejadas;
  document.getElementById('stat-andamento').textContent = andamento;
  document.getElementById('stat-encerradas').textContent = encerradas;
}

function renderizarViagens() {
  const filtradas =
    filtroStatus === 'todas'
      ? todasViagens
      : todasViagens.filter((v) => v.status === filtroStatus);

  if (filtradas.length === 0) {
    gridEl.classList.add('d-none');
    gridEl.innerHTML = '';
    emptyEl.classList.remove('d-none');

    if (termoBuscaAtual || filtroStatus !== 'todas') {
      emptyTitleEl.textContent = 'Nenhuma viagem encontrada para esse filtro';
      emptyDescEl.textContent =
        'Tente ajustar o termo pesquisado ou selecionar outro status de viagem.';
      emptyCtaEl.classList.add('d-none');
    } else {
      emptyTitleEl.textContent = 'Você ainda não tem viagens cadastradas';
      emptyDescEl.textContent =
        'Comece planejando sua primeira viagem com destino, período e orçamento.';
      emptyCtaEl.classList.remove('d-none');
    }
    return;
  }

  emptyEl.classList.add('d-none');
  gridEl.classList.remove('d-none');

  gridEl.innerHTML = filtradas
    .map((viagem) => {
      const duracao = calcularDuracaoDias(viagem.data_inicio, viagem.data_fim);
      const textoDuracao = duracao === 1 ? '1 dia' : `${duracao} dias`;
      const descricaoHtml = viagem.descricao
        ? `<p class="text-secondary small mb-3 text-truncate" title="${escapeHtml(viagem.descricao)}">${escapeHtml(viagem.descricao)}</p>`
        : '<p class="text-muted small fst-italic mb-3">Sem descrição informada.</p>';

      return `
        <div class="col-12 col-md-6 col-xl-4">
          <article class="tc-card tc-trip-card p-4">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
              ${renderStatusBadge(viagem.status)}
              <span class="badge text-bg-light border text-secondary">${textoDuracao}</span>
            </div>

            <h2 class="h5 fw-bold mb-1">
              <a href="/viagem.html?id=${viagem.id}" class="text-decoration-none text-dark stretched-link-disabled">
                ${escapeHtml(viagem.titulo)}
              </a>
            </h2>

            <div class="text-secondary small fw-medium mb-3">
              <i class="bi bi-geo-alt-fill text-primary me-1"></i>${escapeHtml(viagem.destino)}
            </div>

            ${descricaoHtml}

            <div class="mt-auto pt-3 border-top">
              <div class="d-flex justify-content-between align-items-center small mb-2">
                <span class="text-secondary">
                  <i class="bi bi-calendar3 me-1"></i>
                  ${formatarDataBR(viagem.data_inicio)} — ${formatarDataBR(viagem.data_fim)}
                </span>
              </div>

              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="small text-secondary">Orçamento</span>
                <span class="fw-bold text-dark">${formatarMoeda(viagem.orcamento)}</span>
              </div>

              <div class="d-flex gap-2">
                <a href="/viagem.html?id=${viagem.id}" class="btn btn-primary btn-sm flex-grow-1">
                  <i class="bi bi-eye me-1"></i>Ver detalhes
                </a>
                <a
                  href="/viagem-form.html?id=${viagem.id}"
                  class="btn btn-outline-secondary btn-sm"
                  title="Editar viagem"
                  aria-label="Editar viagem ${escapeHtml(viagem.titulo)}"
                >
                  <i class="bi bi-pencil"></i>
                </a>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm btn-excluir-viagem"
                  data-id="${viagem.id}"
                  data-titulo="${escapeHtml(viagem.titulo)}"
                  title="Excluir viagem"
                  aria-label="Excluir viagem ${escapeHtml(viagem.titulo)}"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </article>
        </div>
      `;
    })
    .join('');
}

async function carregarViagens(busca = '') {
  exibirAlertaInline(alertEl, '');
  termoBuscaAtual = busca.trim();
  btnLimparBusca.classList.toggle('d-none', !termoBuscaAtual);

  loadingEl.classList.remove('d-none');
  gridEl.classList.add('d-none');
  emptyEl.classList.add('d-none');

  try {
    todasViagens = await viagensApi.listar(termoBuscaAtual);
    atualizarIndicadores(todasViagens);
    renderizarViagens();
  } catch (err) {
    if (err.status === 401) {
      window.location.replace('/auth.html');
      return;
    }
    exibirAlertaInline(alertEl, err.mensagem || 'Erro ao carregar suas viagens.');
  } finally {
    loadingEl.classList.add('d-none');
  }
}

function configurarFiltrosStatus() {
  const cards = document.querySelectorAll('[data-status-filter]');
  const selecionar = (card) => {
    filtroStatus = card.dataset.statusFilter;
    cards.forEach((c) => c.classList.toggle('active', c === card));
    renderizarViagens();
  };

  cards.forEach((card) => {
    card.addEventListener('click', () => selecionar(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selecionar(card);
      }
    });
  });
}

formBusca?.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(debounceTimer);
  carregarViagens(inputBusca.value);
});

inputBusca?.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    carregarViagens(inputBusca.value);
  }, 320);
});

btnLimparBusca?.addEventListener('click', () => {
  inputBusca.value = '';
  filtroStatus = 'todas';
  document.querySelectorAll('[data-status-filter]').forEach((c) => {
    c.classList.toggle('active', c.dataset.statusFilter === 'todas');
  });
  carregarViagens('');
});

gridEl?.addEventListener('click', async (event) => {
  const btn = event.target.closest('.btn-excluir-viagem');
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const titulo = btn.dataset.titulo || 'esta viagem';

  const confirmado = await confirmarAcao({
    titulo: 'Excluir viagem',
    mensagem: `Tem certeza que deseja excluir a viagem "${titulo}"?`,
    detalhe:
      'Todas as atividades e despesas vinculadas a esta viagem também serão excluídas permanentemente.',
    textoConfirmar: 'Excluir viagem',
    variante: 'danger',
  });

  if (!confirmado) return;

  try {
    await viagensApi.excluir(id);
    showToast('Viagem excluída com sucesso.', 'success');
    await carregarViagens(termoBuscaAtual);
  } catch (err) {
    showToast(err.mensagem || 'Não foi possível excluir a viagem.', 'danger');
  }
});

async function initDashboard() {
  try {
    const usuario = await exigirAutenticacao();
    if (!usuario) return;

    configurarNavbarAutenticada(usuario);
    configurarFiltrosStatus();

    const flash = obterFlashMessage();
    if (flash?.mensagem) {
      showToast(flash.mensagem, flash.tipo || 'success');
    }

    await carregarViagens('');
  } catch (err) {
    loadingEl.classList.add('d-none');
    exibirAlertaInline(alertEl, err.mensagem || 'Erro ao inicializar o dashboard.');
  }
}

initDashboard();
