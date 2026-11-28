import { escapeHtml, formatarDataBR, calcularNumeroDiaViagem } from './ui.js';
import { listarReferenciasDoDestino, buscarReferenciaLocal } from './destinos.js';

let viagemRef = null;
let atividadesRef = [];
let modoTransporte = 'driving';
let filtroDia = 'todos';

function resolverConsultaLugar(texto) {
  const limpo = String(texto || '').trim();
  if (!limpo) return '';

  const destino = viagemRef?.destino || '';
  const ref = buscarReferenciaLocal(limpo, destino);
  if (ref) {
    return ref.displayName;
  }

  if (destino && !limpo.toLowerCase().includes(destino.split('-')[0].trim().toLowerCase())) {
    return `${limpo}, ${destino}, Brasil`;
  }
  return `${limpo}, Brasil`;
}

function urlEmbedBusca(consulta, zoom = 14) {
  const params = new URLSearchParams({
    q: consulta,
    hl: 'pt-BR',
    z: String(zoom),
    output: 'embed',
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

function urlGoogleMapsLugar(consulta) {
  const params = new URLSearchParams({
    api: '1',
    query: consulta,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function urlGoogleMapsRota(paradas, modo) {
  if (!paradas || paradas.length === 0) return '#';
  if (paradas.length === 1) {
    const params = new URLSearchParams({
      api: '1',
      destination: paradas[0].consulta,
      travelmode: modo,
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const params = new URLSearchParams({
    api: '1',
    origin: paradas[0].consulta,
    destination: paradas[paradas.length - 1].consulta,
    travelmode: modo,
  });

  if (paradas.length > 2) {
    params.set(
      'waypoints',
      paradas
        .slice(1, -1)
        .map((p) => p.consulta)
        .join('|')
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function atualizarIframeMapa(consulta, label, zoom = 14) {
  const iframe = document.getElementById('mapa-iframe');
  const tituloEl = document.getElementById('mapa-local-atual');
  const linkAbrir = document.getElementById('btn-abrir-local-gmaps');

  if (iframe) {
    iframe.src = urlEmbedBusca(consulta, zoom);
  }
  if (tituloEl) {
    tituloEl.textContent = label || consulta;
  }
  if (linkAbrir) {
    linkAbrir.href = urlGoogleMapsLugar(consulta);
  }
}

function atualizarSeletorDias() {
  const selectDia = document.getElementById('mapa-filtro-dia');
  if (!selectDia || !viagemRef) return;

  const datasUnicas = [...new Set(atividadesRef.map((a) => a.data_atividade))].sort();
  const valorAnterior = filtroDia;

  selectDia.innerHTML =
    '<option value="todos">Todos os dias do roteiro</option>' +
    datasUnicas
      .map((dataISO) => {
        const numDia = calcularNumeroDiaViagem(viagemRef.data_inicio, dataISO);
        return `<option value="${dataISO}">Dia ${numDia} — ${formatarDataBR(dataISO)}</option>`;
      })
      .join('');

  if (valorAnterior !== 'todos' && datasUnicas.includes(valorAnterior)) {
    selectDia.value = valorAnterior;
  } else {
    filtroDia = 'todos';
    selectDia.value = 'todos';
  }
}

function preencherReferenciasAutocompletar() {
  const lista = listarReferenciasDoDestino(viagemRef?.destino || '');
  const datalistRotas = document.getElementById('mapa-referencias-list');
  if (datalistRotas) {
    datalistRotas.innerHTML = lista
      .map((item) => `<option value="${escapeHtml(item.nome)}">${escapeHtml(item.local)}</option>`)
      .join('');
  }

  const datalistAtividade = document.getElementById('atividade-locais-list');
  if (datalistAtividade) {
    datalistAtividade.innerHTML = lista
      .map((item) => `<option value="${escapeHtml(item.local)}">${escapeHtml(item.nome)}</option>`)
      .join('');
  }
}

function obterParadasDoRoteiro() {
  const filtradas =
    filtroDia === 'todos'
      ? atividadesRef
      : atividadesRef.filter((a) => a.data_atividade === filtroDia);

  return filtradas
    .filter((a) => a.local_atividade && a.local_atividade.trim() !== '')
    .map((a) => ({
      titulo: a.titulo,
      local: a.local_atividade.trim(),
      consulta: resolverConsultaLugar(a.local_atividade.trim()),
      data: a.data_atividade,
      horario: a.horario,
      concluida: a.concluida,
    }));
}

function renderizarListaParadas(paradas) {
  const paradasEl = document.getElementById('mapa-total-paradas');
  const trechosEl = document.getElementById('mapa-trechos-lista');
  const btnGmaps = document.getElementById('btn-abrir-gmaps');

  if (paradasEl) {
    paradasEl.textContent = String(paradas.length);
  }

  if (btnGmaps) {
    if (paradas.length > 0) {
      btnGmaps.href = urlGoogleMapsRota(paradas, modoTransporte);
      btnGmaps.classList.remove('disabled');
    } else if (viagemRef?.destino) {
      btnGmaps.href = urlGoogleMapsLugar(`${viagemRef.destino}, Brasil`);
      btnGmaps.classList.remove('disabled');
    } else {
      btnGmaps.href = '#';
      btnGmaps.classList.add('disabled');
    }
  }

  if (!trechosEl) return;

  if (paradas.length === 0) {
    trechosEl.innerHTML = `
      <div class="text-secondary small">
        Adicione atividades com <strong>Local</strong> preenchido no roteiro para montar a rota
        completa ou use o formulário abaixo para abrir uma rota direta no Google Maps.
      </div>
    `;
    return;
  }

  trechosEl.innerHTML = paradas
    .map(
      (p, idx) => `
      <div class="tc-route-stop-card p-2 rounded-3 border d-flex align-items-start gap-2">
        <span class="tc-route-step-num ${p.concluida ? 'is-done' : ''}">${idx + 1}</span>
        <div class="flex-grow-1 min-w-0">
          <div class="fw-semibold small text-truncate">${escapeHtml(p.titulo)}</div>
          <div class="text-secondary small text-truncate">
            ${p.horario ? `${escapeHtml(p.horario)} &bull; ` : ''}${escapeHtml(p.local)}
          </div>
          <div class="d-flex gap-2 mt-1">
            <button
              type="button"
              class="btn btn-link btn-sm p-0 text-decoration-none small btn-ver-parada"
              data-consulta="${escapeHtml(p.consulta)}"
              data-label="${escapeHtml(p.titulo)}"
            >
              Ver no mapa
            </button>
            <span class="text-muted small">&bull;</span>
            <a
              href="${urlGoogleMapsRota([p], modoTransporte)}"
              target="_blank"
              rel="noopener noreferrer"
              class="small text-decoration-none"
            >
              Como chegar <i class="bi bi-box-arrow-up-right"></i>
            </a>
          </div>
        </div>
      </div>
    `
    )
    .join('');
}

export async function atualizarMapaRoteiro() {
  if (!viagemRef) return;
  atualizarSeletorDias();

  const paradas = obterParadasDoRoteiro();
  renderizarListaParadas(paradas);

  if (paradas.length > 0) {
    atualizarIframeMapa(paradas[0].consulta, paradas[0].titulo, 14);
  } else {
    atualizarIframeMapa(`${viagemRef.destino}, Brasil`, viagemRef.destino, 12);
  }
}

export async function focarLocalNoMapa({ nome, endereco }) {
  const consulta = resolverConsultaLugar(endereco || nome);
  atualizarIframeMapa(consulta, nome || endereco, 15);
}

function handleBuscaLocalMapa(event) {
  event.preventDefault();
  const termo = document.getElementById('mapa-busca-local')?.value.trim();
  if (!termo) return;
  const consulta = resolverConsultaLugar(termo);
  atualizarIframeMapa(consulta, termo, 15);
}

function handleRotaPersonalizada(event) {
  event.preventDefault();
  const origemTxt = document.getElementById('rota-origem')?.value.trim();
  const destinoTxt = document.getElementById('rota-destino')?.value.trim();
  if (!origemTxt || !destinoTxt) return;

  const origemConsulta = resolverConsultaLugar(origemTxt);
  const destinoConsulta = resolverConsultaLugar(destinoTxt);
  const url = urlGoogleMapsRota(
    [{ consulta: origemConsulta }, { consulta: destinoConsulta }],
    modoTransporte
  );

  atualizarIframeMapa(destinoConsulta, `${origemTxt} → ${destinoTxt}`, 14);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function inicializarModuloMapa(viagem, atividades) {
  viagemRef = viagem;
  atividadesRef = atividades;
  preencherReferenciasAutocompletar();

  const selectDia = document.getElementById('mapa-filtro-dia');
  selectDia?.addEventListener('change', () => {
    filtroDia = selectDia.value;
    atualizarMapaRoteiro();
  });

  document.querySelectorAll('[data-route-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      modoTransporte = btn.dataset.routeMode;
      document.querySelectorAll('[data-route-mode]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      renderizarListaParadas(obterParadasDoRoteiro());
    });
  });

  document.getElementById('btn-recalcular-rota')?.addEventListener('click', () => {
    atualizarMapaRoteiro();
  });

  document.getElementById('form-busca-mapa')?.addEventListener('submit', handleBuscaLocalMapa);
  document.getElementById('form-rota-custom')?.addEventListener('submit', handleRotaPersonalizada);

  document.getElementById('mapa-trechos-lista')?.addEventListener('click', (event) => {
    const btn = event.target.closest('.btn-ver-parada');
    if (!btn) return;
    atualizarIframeMapa(btn.dataset.consulta, btn.dataset.label, 15);
  });
}

export function sincronizarAtividadesMapa(novasAtividades) {
  atividadesRef = novasAtividades;
  atualizarSeletorDias();
  renderizarListaParadas(obterParadasDoRoteiro());
}

export function redimensionarMapa() {
}
