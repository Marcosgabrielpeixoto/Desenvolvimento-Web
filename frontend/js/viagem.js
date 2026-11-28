import { viagensApi, atividadesApi, despesasApi } from './api.js';
import {
  inicializarModuloMapa,
  atualizarMapaRoteiro,
  sincronizarAtividadesMapa,
  focarLocalNoMapa,
  redimensionarMapa,
} from './mapa.js';
import { inicializarModuloSugestoes, aoAbrirAbaSugestoes } from './sugestoes.js';
import {
  exigirAutenticacao,
  configurarNavbarAutenticada,
  CATEGORIAS_DESPESA,
  escapeHtml,
  formatarMoeda,
  formatarDataBR,
  formatarDataExtensa,
  calcularDuracaoDias,
  calcularNumeroDiaViagem,
  dataHojeISO,
  renderStatusBadge,
  renderCategoriaBadge,
  confirmarAcao,
  showToast,
  exibirAlertaInline,
  setBotaoCarregando,
  obterFlashMessage,
  salvarFlashMessage,
} from './ui.js';

const params = new URLSearchParams(window.location.search);
const viagemId = Number(params.get('id'));

let viagemAtual = null;
let atividades = [];
let despesas = [];
let resumoFinanceiro = null;
let filtroAtividade = 'todas';
let filtroCategoriaDespesa = 'todas';

const loadingEl = document.getElementById('viagem-loading');
const notFoundEl = document.getElementById('viagem-not-found');
const notFoundMessageEl = document.getElementById('not-found-message');
const contentEl = document.getElementById('viagem-content');

const roteiroListaEl = document.getElementById('roteiro-lista');
const roteiroEmptyEl = document.getElementById('roteiro-empty');
const roteiroEmptyTitleEl = document.getElementById('roteiro-empty-title');
const roteiroEmptyDescEl = document.getElementById('roteiro-empty-desc');

const despesasTableCardEl = document.getElementById('despesas-table-card');
const despesasTbodyEl = document.getElementById('despesas-tbody');
const despesasEmptyEl = document.getElementById('despesas-empty');
const despesasEmptyTitleEl = document.getElementById('despesas-empty-title');
const despesasEmptyDescEl = document.getElementById('despesas-empty-desc');
const filtroCategoriaEl = document.getElementById('filtro-categoria-despesa');

const modalAtividadeEl = document.getElementById('modal-atividade');
const formAtividadeEl = document.getElementById('form-atividade');
const atividadeAlertEl = document.getElementById('atividade-modal-alert');
const btnSalvarAtividade = document.getElementById('btn-salvar-atividade');

const modalDespesaEl = document.getElementById('modal-despesa');
const formDespesaEl = document.getElementById('form-despesa');
const despesaAlertEl = document.getElementById('despesa-modal-alert');
const btnSalvarDespesa = document.getElementById('btn-salvar-despesa');

function renderizarCabecalhoEInfo() {
  const duracao = calcularDuracaoDias(viagemAtual.data_inicio, viagemAtual.data_fim);
  const textoDuracao = duracao === 1 ? '1 dia' : `${duracao} dias`;
  const periodoTexto = `${formatarDataBR(viagemAtual.data_inicio)} a ${formatarDataBR(viagemAtual.data_fim)}`;

  document.title = `${viagemAtual.titulo} — TripCraft`;
  document.getElementById('banner-breadcrumb').textContent = viagemAtual.titulo;
  document.getElementById('banner-status').innerHTML = renderStatusBadge(viagemAtual.status);
  document.getElementById('banner-duracao').textContent = textoDuracao;
  document.getElementById('banner-titulo').textContent = viagemAtual.titulo;
  document.getElementById('banner-destino').textContent = viagemAtual.destino;
  document.getElementById('banner-periodo').textContent = periodoTexto;

  const editUrl = `/viagem-form.html?id=${viagemAtual.id}`;
  document.getElementById('btn-editar-viagem').href = editUrl;
  document.getElementById('info-btn-editar').href = editUrl;

  document.getElementById('info-titulo').textContent = viagemAtual.titulo;
  document.getElementById('info-destino').textContent = viagemAtual.destino;
  document.getElementById('info-data-inicio').textContent = formatarDataBR(viagemAtual.data_inicio);
  document.getElementById('info-data-fim').textContent = formatarDataBR(viagemAtual.data_fim);
  document.getElementById('info-duracao').textContent = textoDuracao;
  document.getElementById('info-status').innerHTML = renderStatusBadge(viagemAtual.status);
  document.getElementById('info-orcamento').textContent = formatarMoeda(viagemAtual.orcamento);
  document.getElementById('info-descricao').textContent =
    viagemAtual.descricao || 'Nenhuma descrição informada para esta viagem.';
}

function renderizarResumoFinanceiro() {
  if (!resumoFinanceiro) return;

  const { orcamento, total_gasto: totalGasto, saldo_disponivel: saldo } = resumoFinanceiro;
  const excedido = saldo < 0;

  document.getElementById('quick-orcamento').textContent = formatarMoeda(orcamento);
  document.getElementById('quick-gasto').textContent = formatarMoeda(totalGasto);
  const quickSaldoEl = document.getElementById('quick-saldo');
  quickSaldoEl.textContent = formatarMoeda(saldo);
  quickSaldoEl.className = `h5 fw-bold mb-0 mt-1 ${excedido ? 'text-danger' : 'text-success'}`;

  document.getElementById('resumo-orcamento').textContent = formatarMoeda(orcamento);
  document.getElementById('resumo-total-gasto').textContent = formatarMoeda(totalGasto);
  const resumoSaldoEl = document.getElementById('resumo-saldo');
  resumoSaldoEl.textContent = formatarMoeda(saldo);
  resumoSaldoEl.className = `h4 fw-bold mb-0 mt-1 ${excedido ? 'text-danger' : 'text-success'}`;

  const alertaOrcamentoEl = document.getElementById('alerta-orcamento-excedido');
  const alertaTextoEl = document.getElementById('alerta-orcamento-texto');
  if (excedido) {
    alertaOrcamentoEl.classList.remove('d-none');
    alertaOrcamentoEl.classList.add('d-flex');
    alertaTextoEl.textContent = `Orçamento ultrapassado em ${formatarMoeda(Math.abs(saldo))}! Total gasto: ${formatarMoeda(totalGasto)} de ${formatarMoeda(orcamento)} previstos.`;
  } else {
    alertaOrcamentoEl.classList.add('d-none');
    alertaOrcamentoEl.classList.remove('d-flex');
  }

  let percentual = 0;
  if (orcamento > 0) {
    percentual = (totalGasto / orcamento) * 100;
  } else if (totalGasto > 0) {
    percentual = 100;
  }

  const larguraBarra = Math.min(100, Math.max(0, percentual));
  const barEl = document.getElementById('resumo-progress-bar');
  const badgeEl = document.getElementById('resumo-percentual-badge');

  let corBarra = 'bg-primary';
  let corBadge = 'text-bg-primary';
  if (excedido) {
    corBarra = 'bg-danger';
    corBadge = 'text-bg-danger';
  } else if (percentual >= 80) {
    corBarra = 'bg-warning';
    corBadge = 'text-bg-warning';
  }

  barEl.style.width = `${larguraBarra.toFixed(1)}%`;
  barEl.className = `progress-bar ${corBarra}`;

  badgeEl.className = `badge rounded-pill px-3 py-2 fw-bold ${corBadge}`;
  if (orcamento === 0 && totalGasto > 0) {
    badgeEl.textContent = 'Orçamento excedido';
  } else {
    badgeEl.textContent = `${percentual.toFixed(0)}% utilizado`;
  }

  const wrapperCat = document.getElementById('resumo-categorias-wrapper');
  const gridCat = document.getElementById('resumo-categorias');

  if (despesas.length === 0) {
    wrapperCat.classList.add('d-none');
    gridCat.innerHTML = '';
    return;
  }

  const totaisPorCategoria = {};
  for (const d of despesas) {
    totaisPorCategoria[d.categoria] = (totaisPorCategoria[d.categoria] || 0) + Number(d.valor);
  }

  const entradas = Object.entries(totaisPorCategoria).sort((a, b) => b[1] - a[1]);
  wrapperCat.classList.remove('d-none');
  gridCat.innerHTML = entradas
    .map(([cat, soma]) => {
      const info = CATEGORIAS_DESPESA[cat] || CATEGORIAS_DESPESA.outros;
      const pct = totalGasto > 0 ? Math.round((soma / totalGasto) * 100) : 0;
      return `
        <div class="col-6 col-md-4 col-lg">
          <div class="p-2 px-3 rounded-3 border bg-white h-100">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="small fw-semibold text-secondary">
                <i class="bi ${info.icon} me-1"></i>${escapeHtml(info.label)}
              </span>
              <span class="small text-muted">${pct}%</span>
            </div>
            <div class="fw-bold small">${formatarMoeda(soma)}</div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderizarRoteiro() {
  const concluidasTotal = atividades.filter((a) => a.concluida).length;
  document.getElementById('quick-atividades').textContent = `${concluidasTotal} / ${atividades.length}`;
  document.getElementById('badge-qtd-atividades').textContent = atividades.length;

  let filtradas = atividades;
  if (filtroAtividade === 'pendentes') {
    filtradas = atividades.filter((a) => !a.concluida);
  } else if (filtroAtividade === 'concluidas') {
    filtradas = atividades.filter((a) => a.concluida);
  }

  if (filtradas.length === 0) {
    roteiroListaEl.innerHTML = '';
    roteiroEmptyEl.classList.remove('d-none');
    if (atividades.length > 0) {
      roteiroEmptyTitleEl.textContent = 'Nenhuma atividade neste filtro';
      roteiroEmptyDescEl.textContent = 'Selecione "Todas" para visualizar o roteiro completo.';
    } else {
      roteiroEmptyTitleEl.textContent = 'Nenhuma atividade no roteiro';
      roteiroEmptyDescEl.textContent =
        'Adicione passeios, reservas e compromissos organizados por dia e horário.';
    }
    return;
  }

  roteiroEmptyEl.classList.add('d-none');

  const grupos = new Map();
  for (const atv of filtradas) {
    if (!grupos.has(atv.data_atividade)) {
      grupos.set(atv.data_atividade, []);
    }
    grupos.get(atv.data_atividade).push(atv);
  }

  const html = [];
  for (const [dataISO, listaDia] of grupos.entries()) {
    const numDia = calcularNumeroDiaViagem(viagemAtual.data_inicio, dataISO);
    const itensHtml = listaDia
      .map((atv) => {
        const horarioTexto = atv.horario ? atv.horario : 'Sem horário';
        const localHtml = atv.local_atividade
          ? `<span class="small text-secondary"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(atv.local_atividade)}</span>`
          : '';
        const descHtml = atv.descricao
          ? `<p class="small text-secondary mb-0 mt-2" style="white-space: pre-line;">${escapeHtml(atv.descricao)}</p>`
          : '';

        return `
          <div class="tc-activity-item ${atv.concluida ? 'is-done' : ''}">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3">
              <div class="flex-grow-1">
                <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <span class="tc-time-badge">
                    <i class="bi bi-clock"></i>${escapeHtml(horarioTexto)}
                  </span>
                  <h3 class="h6 fw-bold mb-0 tc-activity-title">${escapeHtml(atv.titulo)}</h3>
                  ${
                    atv.concluida
                      ? '<span class="badge text-bg-success rounded-pill"><i class="bi bi-check2 me-1"></i>Concluída</span>'
                      : ''
                  }
                </div>
                ${localHtml}
                ${descHtml}
              </div>

              <div class="d-flex flex-wrap gap-2 flex-shrink-0">
                <button
                  type="button"
                  class="btn btn-sm ${atv.concluida ? 'btn-outline-secondary' : 'btn-outline-success'} btn-toggle-atividade"
                  data-id="${atv.id}"
                  data-concluida="${atv.concluida ? 'true' : 'false'}"
                >
                  <i class="bi ${atv.concluida ? 'bi-arrow-counterclockwise' : 'bi-check2-circle'} me-1"></i>
                  ${atv.concluida ? 'Reabrir' : 'Concluir'}
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary btn-editar-atividade"
                  data-id="${atv.id}"
                  title="Editar atividade"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger btn-excluir-atividade"
                  data-id="${atv.id}"
                  data-titulo="${escapeHtml(atv.titulo)}"
                  title="Excluir atividade"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    html.push(`
      <section>
        <div class="tc-day-header">
          <span class="tc-day-pill">Dia ${numDia}</span>
          <h2 class="h6 fw-bold mb-0 text-dark">${escapeHtml(formatarDataExtensa(dataISO))}</h2>
        </div>
        <div class="d-flex flex-column gap-2">${itensHtml}</div>
      </section>
    `);
  }

  roteiroListaEl.innerHTML = html.join('');
}

function renderizarDespesas() {
  document.getElementById('badge-qtd-despesas').textContent = despesas.length;

  const filtradas =
    filtroCategoriaDespesa === 'todas'
      ? despesas
      : despesas.filter((d) => d.categoria === filtroCategoriaDespesa);

  if (filtradas.length === 0) {
    despesasTableCardEl.classList.add('d-none');
    despesasTbodyEl.innerHTML = '';
    despesasEmptyEl.classList.remove('d-none');

    if (despesas.length > 0) {
      despesasEmptyTitleEl.textContent = 'Nenhuma despesa nessa categoria';
      despesasEmptyDescEl.textContent = 'Selecione "Todas" para ver todos os gastos da viagem.';
    } else {
      despesasEmptyTitleEl.textContent = 'Nenhuma despesa registrada';
      despesasEmptyDescEl.textContent =
        'Registre seus gastos para acompanhar o total acumulado e o saldo disponível.';
    }
    return;
  }

  despesasEmptyEl.classList.add('d-none');
  despesasTableCardEl.classList.remove('d-none');

  despesasTbodyEl.innerHTML = filtradas
    .map(
      (desp) => `
      <tr>
        <td class="ps-4 fw-semibold">${escapeHtml(desp.descricao)}</td>
        <td>${renderCategoriaBadge(desp.categoria)}</td>
        <td class="text-secondary small text-nowrap">${formatarDataBR(desp.data_despesa)}</td>
        <td class="text-end fw-bold text-nowrap">${formatarMoeda(desp.valor)}</td>
        <td class="text-end pe-4 text-nowrap">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary me-1 btn-editar-despesa"
            data-id="${desp.id}"
            title="Editar despesa"
            aria-label="Editar despesa ${escapeHtml(desp.descricao)}"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger btn-excluir-despesa"
            data-id="${desp.id}"
            data-descricao="${escapeHtml(desp.descricao)}"
            title="Excluir despesa"
            aria-label="Excluir despesa ${escapeHtml(desp.descricao)}"
          >
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `
    )
    .join('');
}

async function recarregarAtividades() {
  atividades = await atividadesApi.listarPorViagem(viagemId);
  renderizarRoteiro();
  sincronizarAtividadesMapa(atividades);
}

async function recarregarDespesasEResumo() {
  const [listaDespesas, resumo] = await Promise.all([
    despesasApi.listarPorViagem(viagemId),
    despesasApi.obterResumo(viagemId),
  ]);
  despesas = listaDespesas;
  resumoFinanceiro = resumo;
  renderizarResumoFinanceiro();
  renderizarDespesas();
}

function abrirModalAtividade(atividade = null, sugestao = null) {
  exibirAlertaInline(atividadeAlertEl, '');
  formAtividadeEl.reset();

  const periodoHint = document.getElementById('atividade-periodo-hint');
  periodoHint.textContent = `Período da viagem: ${formatarDataBR(viagemAtual.data_inicio)} a ${formatarDataBR(viagemAtual.data_fim)}`;

  const inputData = document.getElementById('atividade-data');
  inputData.min = viagemAtual.data_inicio;
  inputData.max = viagemAtual.data_fim;

  if (atividade) {
    document.getElementById('modal-atividade-title').textContent = 'Editar atividade';
    btnSalvarAtividade.textContent = 'Salvar alterações';
    document.getElementById('atividade-id').value = atividade.id;
    document.getElementById('atividade-titulo').value = atividade.titulo;
    inputData.value = atividade.data_atividade;
    document.getElementById('atividade-horario').value = atividade.horario || '';
    document.getElementById('atividade-local').value = atividade.local_atividade || '';
    document.getElementById('atividade-descricao').value = atividade.descricao || '';
  } else {
    document.getElementById('modal-atividade-title').textContent = sugestao
      ? 'Adicionar sugestão ao roteiro'
      : 'Nova atividade';
    btnSalvarAtividade.textContent = 'Salvar atividade';
    document.getElementById('atividade-id').value = '';
    inputData.value = viagemAtual.data_inicio;
    if (sugestao) {
      document.getElementById('atividade-titulo').value = sugestao.nome || '';
      document.getElementById('atividade-horario').value = sugestao.horario || '';
      document.getElementById('atividade-local').value = sugestao.local || '';
      document.getElementById('atividade-descricao').value = sugestao.descricao || '';
    }
  }

  window.bootstrap.Modal.getOrCreateInstance(modalAtividadeEl).show();
}

formAtividadeEl?.addEventListener('submit', async (event) => {
  event.preventDefault();
  exibirAlertaInline(atividadeAlertEl, '');

  const id = document.getElementById('atividade-id').value;
  const titulo = document.getElementById('atividade-titulo').value.trim();
  const data_atividade = document.getElementById('atividade-data').value;
  const horario = document.getElementById('atividade-horario').value || null;
  const local_atividade = document.getElementById('atividade-local').value.trim() || null;
  const descricao = document.getElementById('atividade-descricao').value.trim() || null;

  if (!titulo) {
    exibirAlertaInline(atividadeAlertEl, 'Informe o título da atividade.');
    return;
  }
  if (!data_atividade) {
    exibirAlertaInline(atividadeAlertEl, 'Informe a data da atividade.');
    return;
  }
  if (data_atividade < viagemAtual.data_inicio || data_atividade > viagemAtual.data_fim) {
    exibirAlertaInline(
      atividadeAlertEl,
      `A data da atividade deve estar entre ${formatarDataBR(viagemAtual.data_inicio)} e ${formatarDataBR(viagemAtual.data_fim)}.`
    );
    return;
  }

  const payload = { titulo, data_atividade, horario, local_atividade, descricao };

  setBotaoCarregando(btnSalvarAtividade, true, 'Salvando...');
  try {
    if (id) {
      await atividadesApi.atualizar(id, payload);
      showToast('Atividade atualizada com sucesso!', 'success');
    } else {
      await atividadesApi.criar(viagemId, payload);
      showToast('Atividade adicionada ao roteiro!', 'success');
    }
    window.bootstrap.Modal.getInstance(modalAtividadeEl)?.hide();
    await recarregarAtividades();
  } catch (err) {
    exibirAlertaInline(atividadeAlertEl, err.mensagem || 'Erro ao salvar atividade.');
  } finally {
    setBotaoCarregando(btnSalvarAtividade, false);
  }
});

function abrirModalDespesa(despesa = null) {
  exibirAlertaInline(despesaAlertEl, '');
  formDespesaEl.reset();

  if (despesa) {
    document.getElementById('modal-despesa-title').textContent = 'Editar despesa';
    btnSalvarDespesa.textContent = 'Salvar alterações';
    document.getElementById('despesa-id').value = despesa.id;
    document.getElementById('despesa-descricao').value = despesa.descricao;
    document.getElementById('despesa-categoria').value = despesa.categoria;
    document.getElementById('despesa-valor').value = Number(despesa.valor).toFixed(2);
    document.getElementById('despesa-data').value = despesa.data_despesa;
  } else {
    document.getElementById('modal-despesa-title').textContent = 'Nova despesa';
    btnSalvarDespesa.textContent = 'Salvar despesa';
    document.getElementById('despesa-id').value = '';
    document.getElementById('despesa-categoria').value = 'alimentacao';
    document.getElementById('despesa-data').value = dataHojeISO();
  }

  window.bootstrap.Modal.getOrCreateInstance(modalDespesaEl).show();
}

formDespesaEl?.addEventListener('submit', async (event) => {
  event.preventDefault();
  exibirAlertaInline(despesaAlertEl, '');

  const id = document.getElementById('despesa-id').value;
  const descricao = document.getElementById('despesa-descricao').value.trim();
  const categoria = document.getElementById('despesa-categoria').value;
  const valorStr = document.getElementById('despesa-valor').value.trim();
  const valor = Number(valorStr);
  const data_despesa = document.getElementById('despesa-data').value;

  if (!descricao) {
    exibirAlertaInline(despesaAlertEl, 'Informe a descrição da despesa.');
    return;
  }
  if (valorStr === '' || Number.isNaN(valor) || !Number.isFinite(valor) || valor <= 0) {
    exibirAlertaInline(despesaAlertEl, 'O valor da despesa deve ser maior que zero.');
    return;
  }
  if (!data_despesa) {
    exibirAlertaInline(despesaAlertEl, 'Informe a data da despesa.');
    return;
  }

  const payload = {
    descricao,
    categoria,
    valor: Number(valor.toFixed(2)),
    data_despesa,
  };

  setBotaoCarregando(btnSalvarDespesa, true, 'Salvando...');
  try {
    if (id) {
      await despesasApi.atualizar(id, payload);
      showToast('Despesa atualizada com sucesso!', 'success');
    } else {
      await despesasApi.criar(viagemId, payload);
      showToast('Despesa registrada com sucesso!', 'success');
    }
    window.bootstrap.Modal.getInstance(modalDespesaEl)?.hide();
    await recarregarDespesasEResumo();
  } catch (err) {
    exibirAlertaInline(despesaAlertEl, err.mensagem || 'Erro ao salvar despesa.');
  } finally {
    setBotaoCarregando(btnSalvarDespesa, false);
  }
});

document.getElementById('btn-nova-atividade')?.addEventListener('click', () => abrirModalAtividade());
document.getElementById('btn-empty-atividade')?.addEventListener('click', () => abrirModalAtividade());
document.getElementById('btn-nova-despesa')?.addEventListener('click', () => abrirModalDespesa());
document.getElementById('btn-empty-despesa')?.addEventListener('click', () => abrirModalDespesa());

document.querySelectorAll('[data-atv-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    filtroAtividade = btn.dataset.atvFilter;
    document.querySelectorAll('[data-atv-filter]').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    renderizarRoteiro();
  });
});

filtroCategoriaEl?.addEventListener('change', () => {
  filtroCategoriaDespesa = filtroCategoriaEl.value;
  renderizarDespesas();
});

roteiroListaEl?.addEventListener('click', async (event) => {
  const btnToggle = event.target.closest('.btn-toggle-atividade');
  if (btnToggle) {
    const id = Number(btnToggle.dataset.id);
    const concluidaAtual = btnToggle.dataset.concluida === 'true';
    btnToggle.disabled = true;
    try {
      await atividadesApi.alterarConclusao(id, !concluidaAtual);
      showToast(
        !concluidaAtual ? 'Atividade marcada como concluída.' : 'Atividade marcada como pendente.',
        'success'
      );
      await recarregarAtividades();
    } catch (err) {
      btnToggle.disabled = false;
      showToast(err.mensagem || 'Não foi possível atualizar a atividade.', 'danger');
    }
    return;
  }

  const btnEditar = event.target.closest('.btn-editar-atividade');
  if (btnEditar) {
    const id = Number(btnEditar.dataset.id);
    const atv = atividades.find((a) => a.id === id);
    if (atv) abrirModalAtividade(atv);
    return;
  }

  const btnExcluir = event.target.closest('.btn-excluir-atividade');
  if (btnExcluir) {
    const id = Number(btnExcluir.dataset.id);
    const titulo = btnExcluir.dataset.titulo || 'esta atividade';
    const confirmado = await confirmarAcao({
      titulo: 'Excluir atividade',
      mensagem: `Deseja excluir a atividade "${titulo}"?`,
      textoConfirmar: 'Excluir atividade',
      variante: 'danger',
    });
    if (!confirmado) return;

    try {
      await atividadesApi.excluir(id);
      showToast('Atividade excluída com sucesso.', 'success');
      await recarregarAtividades();
    } catch (err) {
      showToast(err.mensagem || 'Não foi possível excluir a atividade.', 'danger');
    }
  }
});

despesasTbodyEl?.addEventListener('click', async (event) => {
  const btnEditar = event.target.closest('.btn-editar-despesa');
  if (btnEditar) {
    const id = Number(btnEditar.dataset.id);
    const desp = despesas.find((d) => d.id === id);
    if (desp) abrirModalDespesa(desp);
    return;
  }

  const btnExcluir = event.target.closest('.btn-excluir-despesa');
  if (btnExcluir) {
    const id = Number(btnExcluir.dataset.id);
    const descricao = btnExcluir.dataset.descricao || 'esta despesa';
    const confirmado = await confirmarAcao({
      titulo: 'Excluir despesa',
      mensagem: `Deseja excluir a despesa "${descricao}"?`,
      detalhe: 'O total gasto e o saldo disponível serão recalculados automaticamente.',
      textoConfirmar: 'Excluir despesa',
      variante: 'danger',
    });
    if (!confirmado) return;

    try {
      await despesasApi.excluir(id);
      showToast('Despesa excluída e resumo atualizado.', 'success');
      await recarregarDespesasEResumo();
    } catch (err) {
      showToast(err.mensagem || 'Não foi possível excluir a despesa.', 'danger');
    }
  }
});

document.getElementById('btn-excluir-viagem')?.addEventListener('click', async () => {
  if (!viagemAtual) return;
  const confirmado = await confirmarAcao({
    titulo: 'Excluir viagem',
    mensagem: `Tem certeza que deseja excluir a viagem "${viagemAtual.titulo}"?`,
    detalhe:
      'Todas as atividades e despesas associadas a esta viagem também serão removidas permanentemente.',
    textoConfirmar: 'Excluir viagem',
    variante: 'danger',
  });
  if (!confirmado) return;

  try {
    await viagensApi.excluir(viagemAtual.id);
    salvarFlashMessage('Viagem excluída com sucesso.', 'success');
    window.location.replace('/dashboard.html');
  } catch (err) {
    showToast(err.mensagem || 'Não foi possível excluir a viagem.', 'danger');
  }
});

function ativarAbaInicial() {
  const aba = params.get('aba') || window.location.hash.replace('#', '');
  if (aba === 'despesas') {
    window.bootstrap.Tab.getOrCreateInstance(document.getElementById('tab-despesas-btn')).show();
  } else if (aba === 'mapa') {
    window.bootstrap.Tab.getOrCreateInstance(document.getElementById('tab-mapa-btn')).show();
  } else if (aba === 'sugestoes') {
    window.bootstrap.Tab.getOrCreateInstance(document.getElementById('tab-sugestoes-btn')).show();
  } else if (aba === 'informacoes') {
    window.bootstrap.Tab.getOrCreateInstance(document.getElementById('tab-info-btn')).show();
  }
}

let mapaJaCarregado = false;
let sugestaoPendenteMapa = null;

document.getElementById('tab-mapa-btn')?.addEventListener('shown.bs.tab', async () => {
  redimensionarMapa();
  if (!mapaJaCarregado) {
    mapaJaCarregado = true;
    await atualizarMapaRoteiro();
  } else if (!sugestaoPendenteMapa) {
    await atualizarMapaRoteiro();
  }

  if (sugestaoPendenteMapa) {
    const alvo = sugestaoPendenteMapa;
    sugestaoPendenteMapa = null;
    await focarLocalNoMapa(alvo);
  }
});

document.getElementById('tab-sugestoes-btn')?.addEventListener('shown.bs.tab', () => {
  aoAbrirAbaSugestoes();
});

async function initViagem() {
  try {
    const usuario = await exigirAutenticacao();
    if (!usuario) return;

    configurarNavbarAutenticada(usuario);

    if (!Number.isInteger(viagemId) || viagemId <= 0) {
      loadingEl.classList.add('d-none');
      notFoundMessageEl.textContent = 'Identificador de viagem inválido.';
      notFoundEl.classList.remove('d-none');
      return;
    }

    viagemAtual = await viagensApi.buscarPorId(viagemId);
    const [listaAtividades, listaDespesas, resumo] = await Promise.all([
      atividadesApi.listarPorViagem(viagemId),
      despesasApi.listarPorViagem(viagemId),
      despesasApi.obterResumo(viagemId),
    ]);

    atividades = listaAtividades;
    despesas = listaDespesas;
    resumoFinanceiro = resumo;

    renderizarCabecalhoEInfo();
    renderizarResumoFinanceiro();
    renderizarRoteiro();
    renderizarDespesas();

    inicializarModuloMapa(viagemAtual, atividades);
    inicializarModuloSugestoes(viagemAtual, {
      onAdicionar: (sugestao) => abrirModalAtividade(null, sugestao),
      onVerNoMapa: (sugestao) => {
        sugestaoPendenteMapa = {
          nome: sugestao.nome,
          endereco: sugestao.local,
          lat: sugestao.lat,
          lon: sugestao.lon,
        };
        const tabMapa = document.getElementById('tab-mapa-btn');
        if (tabMapa) {
          window.bootstrap.Tab.getOrCreateInstance(tabMapa).show();
        }
      },
    });

    ativarAbaInicial();

    loadingEl.classList.add('d-none');
    contentEl.classList.remove('d-none');

    const flash = obterFlashMessage();
    if (flash?.mensagem) {
      showToast(flash.mensagem, flash.tipo || 'success');
    }
  } catch (err) {
    loadingEl.classList.add('d-none');
    if (err.status === 401) {
      window.location.replace('/auth.html');
      return;
    }
    if (err.status === 404 || err.status === 400) {
      notFoundMessageEl.textContent =
        err.mensagem || 'A viagem solicitada não existe ou pertence a outra conta.';
      notFoundEl.classList.remove('d-none');
      return;
    }
    notFoundMessageEl.textContent = err.mensagem || 'Erro ao carregar os detalhes da viagem.';
    notFoundEl.classList.remove('d-none');
  }
}

initViagem();
