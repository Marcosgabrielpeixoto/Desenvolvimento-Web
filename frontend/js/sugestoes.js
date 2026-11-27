/**
 * Módulo de sugestão de lugares por destino.
 * Combina catálogo curado de pontos turísticos do Brasil e do mundo com
 * busca em tempo real via OpenStreetMap (Nominatim + Overpass API) para qualquer cidade.
 */

import { escapeHtml } from './ui.js';
import { geocodificarLocal } from './mapa.js';

const CATEGORIAS_SUGESTAO = {
  turismo: { label: 'Ponto turístico', icon: 'bi-camera-fill', css: 'tc-cat-passeios' },
  natureza: { label: 'Natureza', icon: 'bi-tree-fill', css: 'tc-status-andamento' },
  cultura: { label: 'Cultura', icon: 'bi-bank2', css: 'tc-cat-hospedagem' },
  gastronomia: { label: 'Gastronomia', icon: 'bi-cup-hot-fill', css: 'tc-cat-alimentacao' },
};

const CATALOGO_DESTINOS = [
  {
    chaves: ['manaus', 'amazonas'],
    lugares: [
      {
        nome: 'Teatro Amazonas',
        categoria: 'cultura',
        local: 'Largo de São Sebastião, Centro, Manaus',
        horario: '09:30',
        descricao: 'Ícone arquitetônico do ciclo da borracha com visitas guiadas e programação cultural.',
        lat: -3.1303,
        lon: -60.0234,
      },
      {
        nome: 'Encontro das Águas',
        categoria: 'natureza',
        local: 'Porto de Manaus, Centro, Manaus',
        horario: '14:00',
        descricao: 'Passeio de barco para observar o encontro dos rios Negro e Solimões.',
        lat: -3.1394,
        lon: -59.9038,
      },
      {
        nome: 'MUSA — Museu da Amazônia',
        categoria: 'natureza',
        local: 'Av. Margarita, Cidade de Deus, Manaus',
        horario: '08:30',
        descricao: 'Jardim botânico com trilhas na floresta e torre de observação de 42 metros.',
        lat: -3.0056,
        lon: -59.9394,
      },
      {
        nome: 'Mercado Municipal Adolpho Lisboa',
        categoria: 'gastronomia',
        local: 'Rua dos Barés, 46, Centro, Manaus',
        horario: '11:30',
        descricao: 'Mercado histórico às margens do Rio Negro com peixes regionais, frutas e artesanato.',
        lat: -3.1397,
        lon: -60.0235,
      },
      {
        nome: 'Praia da Ponta Negra',
        categoria: 'turismo',
        local: 'Av. Coronel Teixeira, Ponta Negra, Manaus',
        horario: '17:00',
        descricao: 'Orla urbanizada ideal para caminhada e pôr do sol às margens do Rio Negro.',
        lat: -3.0664,
        lon: -60.1046,
      },
    ],
  },
  {
    chaves: ['itacoatiara'],
    lugares: [
      {
        nome: 'Orla de Itacoatiara',
        categoria: 'turismo',
        local: 'Av. Parque, Centro, Itacoatiara - AM',
        horario: '17:00',
        descricao: 'Vista panorâmica do Rio Amazonas com calçadão, quiosques e fim de tarde.',
        lat: -3.1445,
        lon: -58.4454,
      },
      {
        nome: 'Igreja Matriz de Nossa Senhora do Rosário',
        categoria: 'cultura',
        local: 'Praça da Matriz, Centro, Itacoatiara - AM',
        horario: '09:30',
        descricao: 'Marco histórico e religioso tradicional no centro da cidade.',
        lat: -3.1422,
        lon: -58.4442,
      },
      {
        nome: 'Lago do Canaçari',
        categoria: 'natureza',
        local: 'Zona Rural, Itacoatiara - AM',
        horario: '08:30',
        descricao: 'Passeio ecológico com paisagens amazônicas, pesca esportiva e observação de fauna.',
        lat: -3.081,
        lon: -58.485,
      },
      {
        nome: 'Feira do Produtor e Culinária Regional',
        categoria: 'gastronomia',
        local: 'Centro, Itacoatiara - AM',
        horario: '12:00',
        descricao: 'Peixes assados na brasa, tacacá e frutas típicas da região.',
        lat: -3.1415,
        lon: -58.4418,
      },
    ],
  },
  {
    chaves: ['presidente figueiredo'],
    lugares: [
      {
        nome: 'Cachoeira de Iracema',
        categoria: 'natureza',
        local: 'BR-174, km 115, Presidente Figueiredo - AM',
        horario: '09:00',
        descricao: 'Trilha leve com quedas d’água e grutas em meio à floresta.',
        lat: -1.985,
        lon: -60.062,
      },
      {
        nome: 'Cachoeira do Santuário',
        categoria: 'natureza',
        local: 'AM-240, km 12, Presidente Figueiredo - AM',
        horario: '13:30',
        descricao: 'Reserva ecológica estruturada com trilhas e piscinas naturais.',
        lat: -2.0548,
        lon: -59.9324,
      },
      {
        nome: 'Caverna Refúgio do Maroaga',
        categoria: 'turismo',
        local: 'AM-240, km 6, Presidente Figueiredo - AM',
        horario: '10:00',
        descricao: 'Gruta de arenito com rio subterrâneo e trilha guiada.',
        lat: -2.0493,
        lon: -59.9722,
      },
    ],
  },
  {
    chaves: ['rio de janeiro', 'copacabana', 'ipanema'],
    lugares: [
      {
        nome: 'Cristo Redentor (Corcovado)',
        categoria: 'turismo',
        local: 'Parque Nacional da Tijuca, Rio de Janeiro',
        horario: '08:30',
        descricao: 'Uma das Sete Maravilhas do Mundo Moderno com vista de 360° do Rio.',
        lat: -22.9519,
        lon: -43.2105,
      },
      {
        nome: 'Parque Bondinho Pão de Açúcar',
        categoria: 'turismo',
        local: 'Av. Pasteur, 520, Urca, Rio de Janeiro',
        horario: '16:00',
        descricao: 'Teleférico icônico com vista espetacular da Baía de Guanabara ao pôr do sol.',
        lat: -22.9492,
        lon: -43.1545,
      },
      {
        nome: 'Praia de Copacabana e Forte',
        categoria: 'natureza',
        local: 'Av. Atlântica, Copacabana, Rio de Janeiro',
        horario: '10:00',
        descricao: 'Calçadão clássico, banho de mar e café da manhã no Forte de Copacabana.',
        lat: -22.9711,
        lon: -43.1822,
      },
      {
        nome: 'Museu do Amanhã',
        categoria: 'cultura',
        local: 'Praça Mauá, 1, Centro, Rio de Janeiro',
        horario: '14:00',
        descricao: 'Museu interativo de ciências na revitalizada zona portuária.',
        lat: -22.894,
        lon: -43.1795,
      },
    ],
  },
  {
    chaves: ['sao paulo', 'são paulo'],
    lugares: [
      {
        nome: 'Parque Ibirapuera',
        categoria: 'natureza',
        local: 'Av. Pedro Álvares Cabral, Vila Mariana, São Paulo',
        horario: '09:00',
        descricao: 'Maior parque urbano da capital com museus, lagos e ciclovias.',
        lat: -23.5874,
        lon: -46.6576,
      },
      {
        nome: 'MASP — Museu de Arte de São Paulo',
        categoria: 'cultura',
        local: 'Av. Paulista, 1578, Bela Vista, São Paulo',
        horario: '11:00',
        descricao: 'Acervo renomado no coração da Avenida Paulista.',
        lat: -23.5614,
        lon: -46.6559,
      },
      {
        nome: 'Mercado Municipal de São Paulo',
        categoria: 'gastronomia',
        local: 'Rua da Cantareira, 306, Centro, São Paulo',
        horario: '13:00',
        descricao: 'Famoso pelo sanduíche de mortadela, pastel de bacalhau e vitrais históricos.',
        lat: -23.5419,
        lon: -46.6295,
      },
      {
        nome: 'Bairro da Liberdade',
        categoria: 'gastronomia',
        local: 'Praça da Liberdade, São Paulo',
        horario: '16:00',
        descricao: 'Culinária oriental, lojas temáticas e feirinha tradicional.',
        lat: -23.5553,
        lon: -46.6356,
      },
    ],
  },
  {
    chaves: ['foz do iguacu', 'foz do iguaçu', 'iguacu', 'iguaçu'],
    lugares: [
      {
        nome: 'Cataratas do Iguaçu (Parque Nacional)',
        categoria: 'natureza',
        local: 'BR-469, km 18, Foz do Iguaçu - PR',
        horario: '09:00',
        descricao: 'Trilha das Cataratas e mirante da Garganta do Diabo.',
        lat: -25.6953,
        lon: -54.4367,
      },
      {
        nome: 'Parque das Aves',
        categoria: 'natureza',
        local: 'Av. das Cataratas, 12450, Foz do Iguaçu - PR',
        horario: '14:00',
        descricao: 'Viveiros de imersão com aves da Mata Atlântica ao lado do Parque Nacional.',
        lat: -25.6143,
        lon: -54.4827,
      },
      {
        nome: 'Marco das Três Fronteiras',
        categoria: 'turismo',
        local: 'Av. General Meira, Foz do Iguaçu - PR',
        horario: '17:30',
        descricao: 'Encontro dos rios Iguaçu e Paraná com apresentações culturais ao pôr do sol.',
        lat: -25.5892,
        lon: -54.5886,
      },
    ],
  },
  {
    chaves: ['salvador', 'bahia'],
    lugares: [
      {
        nome: 'Pelourinho e Centro Histórico',
        categoria: 'cultura',
        local: 'Largo do Pelourinho, Salvador - BA',
        horario: '09:30',
        descricao: 'Casarões coloniais coloridos, igrejas barrocas e música ao vivo.',
        lat: -12.9718,
        lon: -38.5084,
      },
      {
        nome: 'Elevador Lacerda e Mercado Modelo',
        categoria: 'turismo',
        local: 'Praça Cayru, Comércio, Salvador - BA',
        horario: '14:00',
        descricao: 'Cartão-postal com vista para a Baía de Todos-os-Santos e artesanato baiano.',
        lat: -12.9739,
        lon: -38.5136,
      },
      {
        nome: 'Farol da Barra',
        categoria: 'turismo',
        local: 'Largo do Farol da Barra, Salvador - BA',
        horario: '17:00',
        descricao: 'Museu Náutico e um dos pores do sol mais bonitos do Nordeste.',
        lat: -13.0103,
        lon: -38.5329,
      },
    ],
  },
  {
    chaves: ['gramado', 'canela'],
    lugares: [
      {
        nome: 'Lago Negro',
        categoria: 'natureza',
        local: 'Rua A. J. Renner, Gramado - RS',
        horario: '09:30',
        descricao: 'Passeio de pedalinho e caminhada entre hortênsias e araucárias.',
        lat: -29.3935,
        lon: -50.8758,
      },
      {
        nome: 'Rua Coberta e Palácio dos Festivais',
        categoria: 'gastronomia',
        local: 'Rua Madre Verônica, Centro, Gramado - RS',
        horario: '13:00',
        descricao: 'Cafés, fondues, chocolates artesanais e centro turístico da cidade.',
        lat: -29.3788,
        lon: -50.874,
      },
      {
        nome: 'Catedral de Pedra (Canela)',
        categoria: 'turismo',
        local: 'Praça da Matriz, Canela - RS',
        horario: '18:30',
        descricao: 'Igreja em estilo gótico com show noturno de luzes.',
        lat: -29.3649,
        lon: -50.8114,
      },
    ],
  },
  {
    chaves: ['paris', 'frança', 'franca'],
    lugares: [
      {
        nome: 'Torre Eiffel e Champ de Mars',
        categoria: 'turismo',
        local: 'Champ de Mars, 5 Av. Anatole France, Paris',
        horario: '10:00',
        descricao: 'Subida panorâmica e vista clássica de Paris.',
        lat: 48.8584,
        lon: 2.2945,
      },
      {
        nome: 'Museu do Louvre',
        categoria: 'cultura',
        local: 'Rue de Rivoli, 75001 Paris',
        horario: '14:00',
        descricao: 'Um dos maiores museus do mundo, lar da Mona Lisa e da Vênus de Milo.',
        lat: 48.8606,
        lon: 2.3376,
      },
      {
        nome: 'Basílica de Sacré-Cœur (Montmartre)',
        categoria: 'cultura',
        local: '35 Rue du Chevalier de la Barre, Paris',
        horario: '17:30',
        descricao: 'Bairro boêmio com vista panorâmica da cidade.',
        lat: 48.8867,
        lon: 2.3431,
      },
    ],
  },
  {
    chaves: ['lisboa', 'portugal'],
    lugares: [
      {
        nome: 'Torre de Belém e Pastéis de Belém',
        categoria: 'turismo',
        local: 'Av. Brasília, Belém, Lisboa',
        horario: '09:30',
        descricao: 'Patrimônio mundial às margens do Tejo e parada clássica na confeitaria.',
        lat: 38.6916,
        lon: -9.216,
      },
      {
        nome: 'Castelo de São Jorge e Alfama',
        categoria: 'cultura',
        local: 'R. de Santa Cruz do Castelo, Lisboa',
        horario: '14:30',
        descricao: 'Ruas históricas, miradouros e vista panorâmica de Lisboa.',
        lat: 38.7139,
        lon: -9.1334,
      },
      {
        nome: 'Time Out Market Lisboa',
        categoria: 'gastronomia',
        local: 'Av. 24 de Julho 49, Lisboa',
        horario: '19:30',
        descricao: 'Mercado gastronômico com pratos típicos portugueses.',
        lat: 38.707,
        lon: -9.1459,
      },
    ],
  },
];

let sugestoesCarregadas = [];
let filtroCategoriaAtual = 'todas';
let buscaLiveExecutada = false;
let destinoAtual = '';
let onAdicionarCallback = null;
let onVerNoMapaCallback = null;

function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buscarNoCatalogo(destino) {
  const norm = normalizarTexto(destino);
  for (const entrada of CATALOGO_DESTINOS) {
    if (entrada.chaves.some((chave) => norm.includes(normalizarTexto(chave)))) {
      return entrada.lugares.map((l, idx) => ({ ...l, id: `cat-${idx}`, origem: 'curado' }));
    }
  }
  return [];
}

function mapearCategoriaOSM(tags = {}) {
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') return 'gastronomia';
  if (tags.leisure === 'park' || tags.natural) return 'natureza';
  if (tags.tourism === 'museum' || tags.tourism === 'gallery' || tags.historic) return 'cultura';
  return 'turismo';
}

async function buscarSugestoesOpenStreetMap(destino) {
  const coords = await geocodificarLocal(destino);
  if (!coords) return [];

  const raio = 8000;
  const query = `
    [out:json][timeout:12];
    (
      node["tourism"~"attraction|museum|viewpoint|gallery"]["name"](around:${raio},${coords.lat},${coords.lon});
      node["historic"~"monument|castle|memorial"]["name"](around:${raio},${coords.lat},${coords.lon});
      node["leisure"="park"]["name"](around:${raio},${coords.lat},${coords.lon});
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
      .filter((el) => el.tags?.name && !vistos.has(el.tags.name.toLowerCase()))
      .slice(0, 12)
      .map((el, idx) => {
        const nome = el.tags.name;
        vistos.add(nome.toLowerCase());
        const categoria = mapearCategoriaOSM(el.tags);
        const rua = el.tags['addr:street']
          ? `${el.tags['addr:street']}${el.tags['addr:housenumber'] ? ', ' + el.tags['addr:housenumber'] : ''}, ${destino}`
          : `${nome}, ${destino}`;
        const desc =
          el.tags.description ||
          (categoria === 'gastronomia'
            ? `Opção gastronômica localizada em ${destino}.`
            : categoria === 'natureza'
              ? `Área verde e lazer ao ar livre em ${destino}.`
              : categoria === 'cultura'
                ? `Espaço cultural e histórico em ${destino}.`
                : `Ponto turístico recomendado em ${destino}.`);

        return {
          id: `osm-${el.id || idx}`,
          nome,
          categoria,
          local: rua,
          horario: categoria === 'gastronomia' ? '12:30' : '10:00',
          descricao: desc,
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon,
          origem: 'osm',
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
  if (!gridEl) return;

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
  const nomesExistentes = new Set(sugestoesCarregadas.map((s) => normalizarTexto(s.nome)));

  for (const item of novas) {
    if (!nomesExistentes.has(normalizarTexto(item.nome))) {
      sugestoesCarregadas.push(item);
      nomesExistentes.add(normalizarTexto(item.nome));
    }
  }

  loadingEl?.classList.add('d-none');
  renderizarSugestoes();
}

export function inicializarModuloSugestoes(viagem, { onAdicionar, onVerNoMapa }) {
  destinoAtual = viagem.destino;
  onAdicionarCallback = onAdicionar;
  onVerNoMapaCallback = onVerNoMapa;

  const tituloDestinoEl = document.getElementById('sugestoes-destino-label');
  if (tituloDestinoEl) {
    tituloDestinoEl.textContent = viagem.destino;
  }

  sugestoesCarregadas = buscarNoCatalogo(viagem.destino);
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

  // Se o destino não estiver no catálogo curado, busca automaticamente no OpenStreetMap
  if (sugestoesCarregadas.length === 0) {
    carregarSugestoesLive(false);
  }
}

export function aoAbrirAbaSugestoes() {
  if (sugestoesCarregadas.length === 0 && !buscaLiveExecutada) {
    carregarSugestoesLive(false);
  }
}
