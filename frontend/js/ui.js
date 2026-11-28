import { authApi } from './api.js';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export const CATEGORIAS_DESPESA = {
  alimentacao: { label: 'Alimentação', icon: 'bi-cup-hot', css: 'tc-cat-alimentacao' },
  transporte: { label: 'Transporte', icon: 'bi-car-front', css: 'tc-cat-transporte' },
  hospedagem: { label: 'Hospedagem', icon: 'bi-building', css: 'tc-cat-hospedagem' },
  passeios: { label: 'Passeios', icon: 'bi-compass', css: 'tc-cat-passeios' },
  outros: { label: 'Outros', icon: 'bi-tag', css: 'tc-cat-outros' },
};

export function escapeHtml(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatarMoeda(valor) {
  const numero = Number(valor);
  return currencyFormatter.format(Number.isFinite(numero) ? numero : 0);
}

export function parseDataISO(dataISO) {
  if (!dataISO || typeof dataISO !== 'string') return null;
  const partes = dataISO.split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

export function formatarDataBR(dataISO) {
  const dt = parseDataISO(dataISO);
  if (!dt) return '—';
  const dia = String(dt.getDate()).padStart(2, '0');
  const mes = String(dt.getMonth() + 1).padStart(2, '0');
  const ano = dt.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataExtensa(dataISO) {
  const dt = parseDataISO(dataISO);
  if (!dt) return '—';
  const diaSemana = DIAS_SEMANA[dt.getDay()];
  const dia = String(dt.getDate()).padStart(2, '0');
  const mes = MESES_CURTOS[dt.getMonth()];
  return `${diaSemana}, ${dia} de ${mes} de ${dt.getFullYear()}`;
}

export function calcularDuracaoDias(dataInicioISO, dataFimISO) {
  const ini = parseDataISO(dataInicioISO);
  const fim = parseDataISO(dataFimISO);
  if (!ini || !fim) return 1;
  const msPorDia = 1000 * 60 * 60 * 24;
  const diff = Math.round((fim - ini) / msPorDia);
  return Math.max(1, diff + 1);
}

export function calcularNumeroDiaViagem(dataInicioISO, dataAtividadeISO) {
  const ini = parseDataISO(dataInicioISO);
  const atv = parseDataISO(dataAtividadeISO);
  if (!ini || !atv) return 1;
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((atv - ini) / msPorDia) + 1;
}

export function dataHojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function renderStatusBadge(status) {
  const mapa = {
    Planejada: { css: 'tc-status-planejada', icon: 'bi-calendar-event' },
    'Em andamento': { css: 'tc-status-andamento', icon: 'bi-geo-alt-fill' },
    Encerrada: { css: 'tc-status-encerrada', icon: 'bi-check2-circle' },
  };
  const info = mapa[status] || { css: 'tc-status-encerrada', icon: 'bi-circle' };
  return `<span class="tc-status-badge ${info.css}"><i class="bi ${info.icon}"></i>${escapeHtml(status)}</span>`;
}

export function renderCategoriaBadge(categoria) {
  const info = CATEGORIAS_DESPESA[categoria] || CATEGORIAS_DESPESA.outros;
  return `<span class="tc-cat-badge ${info.css}"><i class="bi ${info.icon}"></i>${escapeHtml(info.label)}</span>`;
}

function garantirContainerToast() {
  let container = document.getElementById('tc-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'tc-toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3 tc-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(mensagem, tipo = 'success') {
  const container = garantirContainerToast();
  const estilos = {
    success: { bg: 'text-bg-success', icon: 'bi-check-circle-fill' },
    danger: { bg: 'text-bg-danger', icon: 'bi-exclamation-triangle-fill' },
    warning: { bg: 'text-bg-warning', icon: 'bi-exclamation-circle-fill' },
    info: { bg: 'text-bg-primary', icon: 'bi-info-circle-fill' },
  };
  const cfg = estilos[tipo] || estilos.info;

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center ${cfg.bg} border-0 shadow`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2 fw-medium">
        <i class="bi ${cfg.icon}"></i>
        <span>${escapeHtml(mensagem)}</span>
      </div>
      <button type="button" class="btn-close ${tipo === 'warning' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  `;

  container.appendChild(toastEl);
  const toast = new window.bootstrap.Toast(toastEl, { delay: 4200 });
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  toast.show();
}

export function exibirAlertaInline(elemento, mensagem, tipo = 'danger') {
  if (!elemento) return;
  if (!mensagem) {
    elemento.classList.add('d-none');
    elemento.innerHTML = '';
    return;
  }
  const icone = tipo === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
  elemento.className = `alert alert-${tipo} d-flex align-items-start gap-2 mb-3`;
  elemento.setAttribute('role', 'alert');
  elemento.innerHTML = `<i class="bi ${icone} mt-1 flex-shrink-0"></i><div>${escapeHtml(mensagem)}</div>`;
}

export function setBotaoCarregando(botao, carregando, textoCarregando = 'Salvando...') {
  if (!botao) return;
  if (carregando) {
    if (!botao.dataset.originalHtml) {
      botao.dataset.originalHtml = botao.innerHTML;
    }
    botao.disabled = true;
    botao.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${escapeHtml(textoCarregando)}`;
  } else {
    botao.disabled = false;
    if (botao.dataset.originalHtml) {
      botao.innerHTML = botao.dataset.originalHtml;
    }
  }
}

export function confirmarAcao({
  titulo = 'Confirmar ação',
  mensagem = 'Deseja realmente continuar?',
  detalhe = '',
  textoConfirmar = 'Confirmar',
  variante = 'danger',
}) {
  return new Promise((resolve) => {
    let modalEl = document.getElementById('tc-confirm-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'tc-confirm-modal';
      modalEl.className = 'modal fade';
      modalEl.tabIndex = -1;
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg rounded-4">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title fw-bold" id="tc-confirm-title"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body pt-2">
              <p class="mb-2" id="tc-confirm-message"></p>
              <p class="small text-muted mb-0 d-none" id="tc-confirm-detail"></p>
            </div>
            <div class="modal-footer border-0 pt-0">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn" id="tc-confirm-ok"></button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    const titleEl = modalEl.querySelector('#tc-confirm-title');
    const msgEl = modalEl.querySelector('#tc-confirm-message');
    const detailEl = modalEl.querySelector('#tc-confirm-detail');
    const okBtn = modalEl.querySelector('#tc-confirm-ok');

    titleEl.textContent = titulo;
    msgEl.textContent = mensagem;
    if (detalhe) {
      detailEl.textContent = detalhe;
      detailEl.classList.remove('d-none');
    } else {
      detailEl.textContent = '';
      detailEl.classList.add('d-none');
    }
    okBtn.className = `btn btn-${variante}`;
    okBtn.textContent = textoConfirmar;

    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    let confirmado = false;

    const onConfirm = () => {
      confirmado = true;
      modal.hide();
    };

    const onHidden = () => {
      okBtn.removeEventListener('click', onConfirm);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
      resolve(confirmado);
    };

    okBtn.addEventListener('click', onConfirm);
    modalEl.addEventListener('hidden.bs.modal', onHidden);
    modal.show();
  });
}

export async function exigirAutenticacao() {
  try {
    const usuario = await authApi.me();
    return usuario;
  } catch (err) {
    if (err.status === 401) {
      const destino = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/auth.html?redirect=${destino}`);
      return null;
    }
    throw err;
  }
}

export function configurarNavbarAutenticada(usuario) {
  const nomeEl = document.getElementById('nav-user-name');
  if (nomeEl && usuario) {
    nomeEl.textContent = usuario.nome;
    nomeEl.title = usuario.email;
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      setBotaoCarregando(btnLogout, true, 'Saindo...');
      try {
        await authApi.logout();
        window.location.replace('/index.html');
      } catch (err) {
        setBotaoCarregando(btnLogout, false);
        showToast(err.mensagem || 'Erro ao encerrar sessão.', 'danger');
      }
    });
  }
}

export function obterFlashMessage() {
  try {
    const raw = sessionStorage.getItem('tc_flash');
    if (!raw) return null;
    sessionStorage.removeItem('tc_flash');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function salvarFlashMessage(mensagem, tipo = 'success') {
  try {
    sessionStorage.setItem('tc_flash', JSON.stringify({ mensagem, tipo }));
  } catch {
  }
}
