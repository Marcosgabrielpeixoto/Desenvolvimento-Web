import { escapeHtml } from './ui.js';
import { geocodificarLocal } from './mapa.js';
import {
  normalizarTexto,
  encontrarDestinoCatalogo,
  obterDestaquesBrasil,
} from './destinos.js';

const CATEGORIAS_SUGESTAO = {
  turismo: { label: 'Ponto turístico', icon: 'bi-camera-fill', css: 'tc-cat-passeios' },
  natureza: { label: 'Natureza', icon: 'bi-tree-fill', css: 'tc-status-andamento' },
  cultura: { label: 'Cultura', icon: 'bi-bank2', css: 'tc-cat-hospedagem' },
  gastronomia: { label: 'Gastronomia', icon: 'bi-cup-hot-fill', css: 'tc-cat-alimentacao' },
};

const REGEX_NAO_LATINO = /[\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F]/;

let sugestoesCarregadas = [];
let filtroCategoriaAtual = 'todas';
let buscaLiveExecutada = false;
let destinoAtual = '';
let usandoFallbackBrasil = false;
let onAdicionarCallback = null;
let onVerNoMapaCallback = null;

function mapearCategoriaOSM(tags = {}) {
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') return 'gastronomia';
  if (tags.leisure === 'park' || tags.natural) return 'natureza';
  if (tags.tourism === 'museum' || tags.tourism === 'gallery' || tags.historic) return 'cultura';
  return 'turismo';
}

async function buscarSugestoesOpenStreetMap(destino) {
  const cat = encontrarDestinoCatalogo(destino);
  const coords = cat
    ? { lat: cat.centro.lat, lon: cat.centro.lon }
    : await geocodificarLocal(destino);
  if (!coords) return [];

  const query = `
    [out:json][timeout:12];
    (
      node["tourism"~"attraction|museum|viewpoint|gallery"]["name"](around:8000,${coords.lat},${coords.lon});
      node["historic"~"monument|castle|memorial"]["name"](around:8000,${coords.lat},${coords.lon});
      node["leisure"="park"]["name"](around:8000,${coords.lat},${coords.lon});
      node["amenity"="restaurant"]["name"](around:4000,${coords.lat},${coords.lon});
    );
    out center 24;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const vistos = new Set();

    return (data.elements || [])
      .filter((el) => {
        const nome = el.tags?.name?.trim();
        if (!nome || REGEX_NAO_LATINO.test(nome)) return false;
        return !vistos.has(nome.toLowerCase());
      })
      .slice(0, 12)
      .map((el, idx) => {
        const nome = el.tags.name.trim();
        vistos.add(nome.toLowerCase());
        const categoria = mapearCategoriaOSM(el.tags);
        const rua = el.tags['addr:street']
          ? `${el.tags['addr:street']}${el.tags['addr:housenumber'] ? ', ' + el.tags['addr:housenumber'] : ''}, ${destino}`
          : `${nome}, ${destino}`;
        const desc =
          el.tags.description && !REGEX_NAO_LATINO.test(el.tags.description)
            ? el.tags.description
            : categoria === 'gastronomia'
              ? `Opção gastronômica em ${destino}.`
              : categoria === 'natureza'
                ? `Área verde e lazer em ${destino}.`
                : categoria === 'cultura'
                  ? `Espaço cultural e histórico em ${destino}.`
                  : `Ponto turístico em ${destino}.`;

        return {
          id: `osm-${el.id || idx}`,
          nome,
          categoria,
          local: rua,
          horario: categoria === 'gastronomia' ? '12:30' : '10:00',
          descricao: desc,
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon,
        };
      });
  } catch {
    return [];
  }
}

function renderizarSugestoes() {
  const gridEl = document.getElementById('sugestoes-grid');
  const emptyEl = document.getElementById('sugestoes-empty');
  const badgeEl = document.getElementById('badge-qtd-sugestoes');
  const destinoLabelEl = document.getElementById('sugestoes-destino-label');
  if (!gridEl) return;

  if (destinoLabelEl) {
    destinoLabelEl.textContent = usandoFallbackBrasil ? 'destaques do Brasil' : destinoAtual;
  }

  if (badgeEl) {
    badgeEl.textContent = String(sugestoesCarregadas.length);
  }

  const filtradas =
    filtroCategoriaAtual === 'todas'
      ? sugestoesCarregadas
      : sugestoesCarregadas.filter((s) => s.categoria === filtroCategoriaAtual);

  if (filtradas.length === 0) {
    gridEl.innerHTML = '';
    emptyEl?.classList.remove('d-none');
    return;
  }

  emptyEl?.classList.add('d-none');
  gridEl.innerHTML = filtradas
    .map((item) => {
      const cat = CATEGORIAS_SUGESTAO[item.categoria] || CATEGORIAS_SUGESTAO.turismo;
      return `
        <div class="col-12 col-md-6">
          <div class="tc-card p-4 h-100 d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
              <span class="tc-cat-badge ${cat.css}">
                <i class="bi ${cat.icon}"></i>${escapeHtml(cat.label)}
              </span>
              ${item.horario ? `<span class="tc-time-badge"><i class="bi bi-clock"></i>${escapeHtml(item.horario)}</span>` : ''}
            </div>

            <h3 class="h6 fw-bold mb-1">${escapeHtml(item.nome)}</h3>
            <div class="small text-secondary mb-2">
              <i class="bi bi-geo-alt me-1 text-primary"></i>${escapeHtml(item.local)}
            </div>
            <p class="small text-secondary mb-3 flex-grow-1">${escapeHtml(item.descricao)}</p>

            <div class="d-flex flex-wrap gap-2 pt-2 border-top">
              <button
                type="button"
                class="btn btn-primary btn-sm flex-grow-1 btn-add-sugestao"
                data-sugestao-id="${escapeHtml(item.id)}"
              >
                <i class="bi bi-plus-lg me-1"></i>Adicionar ao roteiro
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm btn-mapa-sugestao"
                data-sugestao-id="${escapeHtml(item.id)}"
                title="Ver no mapa"
              >
                <i class="bi bi-map me-1"></i>Mapa
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

async function carregarSugestoesLive(forcar = false) {
  const loadingEl = document.getElementById('sugestoes-loading');
  if (buscaLiveExecutada && !forcar) return;

  buscaLiveExecutada = true;
  loadingEl?.classList.remove('d-none');

  const novas = await buscarSugestoesOpenStreetMap(destinoAtual);

  if (novas.length > 0) {
    if (usandoFallbackBrasil) {
      sugestoesCarregadas = [];
      usandoFallbackBrasil = false;
    }
    const nomesExistentes = new Set(sugestoesCarregadas.map((s) => normalizarTexto(s.nome)));
    for (const item of novas) {
      if (!nomesExistentes.has(normalizarTexto(item.nome))) {
        sugestoesCarregadas.push(item);
        nomesExistentes.add(normalizarTexto(item.nome));
      }
    }
  } else if (sugestoesCarregadas.length === 0) {
    usandoFallbackBrasil = true;
    sugestoesCarregadas = obterDestaquesBrasil().map((l, idx) => ({
      ...l,
      id: `br-${idx}`,
    }));
  }

  loadingEl?.classList.add('d-none');
  renderizarSugestoes();
}

export function inicializarModuloSugestoes(viagem, { onAdicionar, onVerNoMapa }) {
  destinoAtual = viagem.destino;
  usandoFallbackBrasil = false;
  buscaLiveExecutada = false;
  onAdicionarCallback = onAdicionar;
  onVerNoMapaCallback = onVerNoMapa;

  const destino = encontrarDestinoCatalogo(viagem.destino);
  sugestoesCarregadas = destino
    ? destino.lugares.map((l, idx) => ({ ...l, id: `cat-${idx}` }))
    : [];
  renderizarSugestoes();

  document.querySelectorAll('[data-sug-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filtroCategoriaAtual = btn.dataset.sugFilter;
      document.querySelectorAll('[data-sug-filter]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      renderizarSugestoes();
    });
  });

  document.getElementById('btn-buscar-mais-sugestoes')?.addEventListener('click', () => {
    carregarSugestoesLive(true);
  });

  document.getElementById('sugestoes-grid')?.addEventListener('click', (event) => {
    const btnAdd = event.target.closest('.btn-add-sugestao');
    if (btnAdd && onAdicionarCallback) {
      const item = sugestoesCarregadas.find((s) => s.id === btnAdd.dataset.sugestaoId);
      if (item) onAdicionarCallback(item);
      return;
    }

    const btnMapa = event.target.closest('.btn-mapa-sugestao');
    if (btnMapa && onVerNoMapaCallback) {
      const item = sugestoesCarregadas.find((s) => s.id === btnMapa.dataset.sugestaoId);
      if (item) onVerNoMapaCallback(item);
    }
  });

  if (sugestoesCarregadas.length === 0) {
    carregarSugestoesLive(false);
  }
}

export function aoAbrirAbaSugestoes() {
  if (sugestoesCarregadas.length === 0 && !buscaLiveExecutada) {
    carregarSugestoesLive(false);
  }
}
