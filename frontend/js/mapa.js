/**
 * Módulo de mapa interativo e indicação de rotas (Leaflet + OpenStreetMap + OSRM).
 * Geocodifica o destino e os locais das atividades do roteiro, traça a rota
 * cronológica entre os pontos e exibe distância, tempo estimado e trechos.
 */

import { escapeHtml, formatarDataBR, calcularNumeroDiaViagem } from './ui.js';

const geocodeCache = new Map();

let mapa = null;
let tileLayerAtual = null;
let layerMarcadores = null;
let layerRota = null;
let layerDestaque = null;

let viagemRef = null;
let atividadesRef = [];
let modoTransporte = 'driving'; // 'driving' | 'foot'
let filtroDia = 'todos';
let destinoCoords = null;
let ultimosPontosRota = [];
let temaObserver = null;

function obterConfigTiles() {
  const escuro = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  if (escuro) {
    return {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    };
  }
  return {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  };
}

function atualizarTilesTema() {
  if (!mapa || !window.L) return;
  const cfg = obterConfigTiles();
  if (tileLayerAtual) {
    mapa.removeLayer(tileLayerAtual);
  }
  tileLayerAtual = window.L.tileLayer(cfg.url, {
    maxZoom: 19,
    attribution: cfg.attribution,
  }).addTo(mapa);
}

export async function geocodificarLocal(consulta, viewbox = null) {
  const chave = `br:${consulta.trim().toLowerCase()}`;
  if (!consulta.trim()) return null;
  if (geocodeCache.has(chave)) {
    return geocodeCache.get(chave);
  }

  try {
    const params = new URLSearchParams({
      q: consulta,
      format: 'json',
      limit: '1',
      countrycodes: 'br',
      'accept-language': 'pt-BR',
    });
    if (viewbox) {
      params.set('viewbox', viewbox);
    }

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const dados = await res.json();
    if (!Array.isArray(dados) || dados.length === 0) {
      geocodeCache.set(chave, null);
      return null;
    }

    const primeiro = dados[0];
    const resultado = {
      lat: Number(primeiro.lat),
      lon: Number(primeiro.lon),
      displayName: primeiro.display_name,
      boundingbox: primeiro.boundingbox,
    };
    geocodeCache.set(chave, resultado);
    return resultado;
  } catch {
    return null;
  }
}

function calcularViewbox(coords) {
  if (!coords) return null;
  const delta = 0.6;
  return `${coords.lon - delta},${coords.lat + delta},${coords.lon + delta},${coords.lat - delta}`;
}

function formatarDistancia(metros) {
  if (!Number.isFinite(metros)) return '—';
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatarDuracao(segundos) {
  if (!Number.isFinite(segundos)) return '—';
  const minutosTotais = Math.max(1, Math.round(segundos / 60));
  if (minutosTotais < 60) return `${minutosTotais} min`;
  const horas = Math.floor(minutosTotais / 60);
  const mins = minutosTotais % 60;
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

function criarIconeNumerado(numero, concluida = false) {
  const classeExtra = concluida ? 'is-done' : '';
  return window.L.divIcon({
    className: 'tc-map-pin-wrapper',
    html: `<div class="tc-map-pin ${classeExtra}">${numero}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function criarIconeDestaque() {
  return window.L.divIcon({
    className: 'tc-map-pin-wrapper',
    html: '<div class="tc-map-pin is-highlight"><i class="bi bi-star-fill"></i></div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

async function calcularRotaOSRM(pontos, perfil) {
  if (pontos.length < 2) return null;
  const coordsStr = pontos.map((p) => `${p.lon},${p.lat}`).join(';');
  const osrmProfile = perfil === 'foot' ? 'foot' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsStr}?overview=full&geometries=geojson&steps=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    return data.routes[0];
  } catch {
    return null;
  }
}

function gerarUrlGoogleMaps(pontos, perfil) {
  if (pontos.length === 0) return '#';
  const travelmode = perfil === 'foot' ? 'walking' : 'driving';
  if (pontos.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${pontos[0].lat},${pontos[0].lon}`;
  }
  const origem = `${pontos[0].lat},${pontos[0].lon}`;
  const destino = `${pontos[pontos.length - 1].lat},${pontos[pontos.length - 1].lon}`;
  const params = new URLSearchParams({
    api: '1',
    origin: origem,
    destination: destino,
    travelmode,
  });
  if (pontos.length > 2) {
    const waypoints = pontos
      .slice(1, -1)
      .map((p) => `${p.lat},${p.lon}`)
      .join('|');
    params.set('waypoints', waypoints);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
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

function setStatusMapa(mensagem, carregando = false) {
  const statusEl = document.getElementById('mapa-status');
  if (!statusEl) return;
  if (!mensagem) {
    statusEl.classList.add('d-none');
    return;
  }
  statusEl.classList.remove('d-none');
  statusEl.innerHTML = carregando
    ? `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${escapeHtml(mensagem)}`
    : `<i class="bi bi-info-circle me-2"></i>${escapeHtml(mensagem)}`;
}

function renderizarResumoRota(pontos, rotaOSRM, naoLocalizadas = []) {
  const resumoEl = document.getElementById('mapa-rota-resumo');
  const distEl = document.getElementById('mapa-distancia-total');
  const tempoEl = document.getElementById('mapa-tempo-total');
  const paradasEl = document.getElementById('mapa-total-paradas');
  const trechosEl = document.getElementById('mapa-trechos-lista');
  const btnGmaps = document.getElementById('btn-abrir-gmaps');

  if (!resumoEl) return;

  ultimosPontosRota = pontos;

  if (btnGmaps) {
    if (pontos.length > 0) {
      btnGmaps.href = gerarUrlGoogleMaps(pontos, modoTransporte);
      btnGmaps.classList.remove('disabled');
    } else {
      btnGmaps.href = '#';
      btnGmaps.classList.add('disabled');
    }
  }

  paradasEl.textContent = String(pontos.length);

  if (rotaOSRM) {
    distEl.textContent = formatarDistancia(rotaOSRM.distance);
    tempoEl.textContent = formatarDuracao(rotaOSRM.duration);
  } else if (pontos.length >= 2) {
    distEl.textContent = 'Linha direta';
    tempoEl.textContent = 'Indisponível';
  } else {
    distEl.textContent = '—';
    tempoEl.textContent = '—';
  }

  if (pontos.length === 0) {
    trechosEl.innerHTML = `
      <div class="text-secondary small">
        Adicione atividades com campo <strong>Local</strong> preenchido no roteiro (ou use a rota
        personalizada abaixo) para visualizar os pontos e trajetos no mapa.
      </div>
    `;
    return;
  }

  const itensHtml = pontos
    .map((p, idx) => {
      const leg = rotaOSRM?.legs?.[idx];
      const trechoHtml = leg
        ? `<div class="tc-route-leg-connector">
             <i class="bi ${modoTransporte === 'foot' ? 'bi-person-walking' : 'bi-car-front-fill'}"></i>
             ${formatarDistancia(leg.distance)} &bull; ${formatarDuracao(leg.duration)}
           </div>`
        : '';

      return `
        <div class="tc-route-stop">
          <div class="d-flex align-items-start gap-2">
            <span class="tc-route-step-num ${p.concluida ? 'is-done' : ''}">${idx + 1}</span>
            <div class="flex-grow-1 min-w-0">
              <div class="fw-semibold small text-truncate">${escapeHtml(p.titulo)}</div>
              <div class="text-secondary small text-truncate">
                ${p.horario ? `${escapeHtml(p.horario)} &bull; ` : ''}${escapeHtml(p.local)}
              </div>
            </div>
          </div>
          ${trechoHtml}
        </div>
      `;
    })
    .join('');

  const avisoNaoLocalizadas =
    naoLocalizadas.length > 0
      ? `<div class="alert alert-warning small py-2 px-3 mt-3 mb-0">
           <i class="bi bi-exclamation-triangle me-1"></i>
           Não foi possível localizar no mapa: ${escapeHtml(naoLocalizadas.join(', '))}.
         </div>`
      : '';

  trechosEl.innerHTML = itensHtml + avisoNaoLocalizadas;
}

function garantirMapaInicializado() {
  const container = document.getElementById('mapa-container');
  if (!container || !window.L) return false;

  if (!mapa) {
    mapa = window.L.map(container, { scrollWheelZoom: true }).setView([-3.119, -60.0217], 12);
    atualizarTilesTema();
    layerMarcadores = window.L.layerGroup().addTo(mapa);
    layerRota = window.L.layerGroup().addTo(mapa);
    layerDestaque = window.L.layerGroup().addTo(mapa);

    if (!temaObserver) {
      temaObserver = new MutationObserver(() => atualizarTilesTema());
      temaObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-bs-theme'],
      });
    }
  }

  return true;
}

async function desenharRotaPontos(pontos, naoLocalizadas = []) {
  layerMarcadores.clearLayers();
  layerRota.clearLayers();

  const bounds = [];

  pontos.forEach((p, idx) => {
    const marker = window.L.marker([p.lat, p.lon], {
      icon: criarIconeNumerado(idx + 1, p.concluida),
    });
    marker.bindPopup(`
      <div class="small">
        <div class="fw-bold mb-1">${idx + 1}. ${escapeHtml(p.titulo)}</div>
        <div class="text-muted">${escapeHtml(p.local)}</div>
        ${p.data ? `<div class="mt-1">${formatarDataBR(p.data)}${p.horario ? ` às ${escapeHtml(p.horario)}` : ''}</div>` : ''}
      </div>
    `);
    marker.addTo(layerMarcadores);
    bounds.push([p.lat, p.lon]);
  });

  let rotaOSRM = null;
  if (pontos.length >= 2) {
    setStatusMapa('Calculando melhor rota entre as paradas...', true);
    rotaOSRM = await calcularRotaOSRM(pontos, modoTransporte);

    if (rotaOSRM?.geometry?.coordinates?.length) {
      const latLngs = rotaOSRM.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      window.L.polyline(latLngs, {
        color: '#0f766e',
        weight: 5,
        opacity: 0.88,
      }).addTo(layerRota);
    } else {
      window.L.polyline(bounds, {
        color: '#0284c7',
        weight: 3,
        dashArray: '8 8',
        opacity: 0.8,
      }).addTo(layerRota);
    }
  }

  if (bounds.length === 1) {
    mapa.setView(bounds[0], 14);
  } else if (bounds.length > 1) {
    mapa.fitBounds(bounds, { padding: [45, 45] });
  } else if (destinoCoords) {
    mapa.setView([destinoCoords.lat, destinoCoords.lon], 12);
    window.L.circleMarker([destinoCoords.lat, destinoCoords.lon], {
      radius: 8,
      color: '#0f766e',
      fillColor: '#14b8a6',
      fillOpacity: 0.5,
    })
      .bindPopup(`<strong>${escapeHtml(viagemRef.destino)}</strong>`)
      .addTo(layerMarcadores);
  }

  setStatusMapa('');
  renderizarResumoRota(pontos, rotaOSRM, naoLocalizadas);
}

export async function atualizarMapaRoteiro() {
  if (!viagemRef || !garantirMapaInicializado()) return;

  mapa.invalidateSize();
  atualizarSeletorDias();

  setStatusMapa('Localizando destino e pontos do roteiro...', true);

  if (!destinoCoords) {
    destinoCoords = await geocodificarLocal(viagemRef.destino);
  }
  const viewbox = calcularViewbox(destinoCoords);

  const filtradas =
    filtroDia === 'todos'
      ? atividadesRef
      : atividadesRef.filter((a) => a.data_atividade === filtroDia);

  const pontosLocalizados = [];
  const naoLocalizadas = [];

  for (const atv of filtradas) {
    const termoLocal = atv.local_atividade?.trim();
    if (!termoLocal) continue;

    // Tenta primeiro "local, destino", depois só "local"
    let coords = await geocodificarLocal(`${termoLocal}, ${viagemRef.destino}`, viewbox);
    if (!coords) {
      coords = await geocodificarLocal(termoLocal, viewbox);
    }

    if (coords) {
      pontosLocalizados.push({
        titulo: atv.titulo,
        local: termoLocal,
        data: atv.data_atividade,
        horario: atv.horario,
        concluida: atv.concluida,
        lat: coords.lat,
        lon: coords.lon,
      });
    } else {
      naoLocalizadas.push(atv.titulo);
    }
  }

  await desenharRotaPontos(pontosLocalizados, naoLocalizadas);
}

export async function focarLocalNoMapa({ nome, endereco, lat, lon }) {
  if (!garantirMapaInicializado()) return;
  mapa.invalidateSize();

  let pontoLat = Number(lat);
  let pontoLon = Number(lon);

  if (!Number.isFinite(pontoLat) || !Number.isFinite(pontoLon)) {
    const viewbox = calcularViewbox(destinoCoords);
    const achado = await geocodificarLocal(`${endereco || nome}, ${viagemRef?.destino || ''}`, viewbox);
    if (!achado) return;
    pontoLat = achado.lat;
    pontoLon = achado.lon;
  }

  layerDestaque.clearLayers();
  const marker = window.L.marker([pontoLat, pontoLon], { icon: criarIconeDestaque() }).addTo(
    layerDestaque
  );

  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pontoLat},${pontoLon}`;
  marker
    .bindPopup(
      `
      <div class="small">
        <div class="fw-bold mb-1">${escapeHtml(nome)}</div>
        ${endereco ? `<div class="text-muted mb-2">${escapeHtml(endereco)}</div>` : ''}
        <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm py-0 px-2">
          <i class="bi bi-sign-turn-right me-1"></i>Traçar rota no Google Maps
        </a>
      </div>
    `
    )
    .openPopup();

  mapa.setView([pontoLat, pontoLon], 15, { animate: true });
}

async function handleRotaPersonalizada(event) {
  event.preventDefault();
  const inputOrigem = document.getElementById('rota-origem');
  const inputDestino = document.getElementById('rota-destino');
  const origemTxt = inputOrigem?.value.trim();
  const destinoTxt = inputDestino?.value.trim();

  if (!origemTxt || !destinoTxt || !garantirMapaInicializado()) return;

  setStatusMapa('Calculando rota personalizada...', true);
  const viewbox = calcularViewbox(destinoCoords);

  const [cOrigem, cDestino] = await Promise.all([
    geocodificarLocal(`${origemTxt}, ${viagemRef.destino}`, viewbox).then(
      (r) => r || geocodificarLocal(origemTxt, viewbox)
    ),
    geocodificarLocal(`${destinoTxt}, ${viagemRef.destino}`, viewbox).then(
      (r) => r || geocodificarLocal(destinoTxt, viewbox)
    ),
  ]);

  if (!cOrigem || !cDestino) {
    setStatusMapa('Não foi possível localizar a origem ou o destino informados.');
    return;
  }

  const pontos = [
    { titulo: origemTxt, local: origemTxt, lat: cOrigem.lat, lon: cOrigem.lon },
    { titulo: destinoTxt, local: destinoTxt, lat: cDestino.lat, lon: cDestino.lon },
  ];
  await desenharRotaPontos(pontos);
}

export function inicializarModuloMapa(viagem, atividades) {
  viagemRef = viagem;
  atividadesRef = atividades;

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
      if (ultimosPontosRota.length >= 2) {
        desenharRotaPontos(ultimosPontosRota);
      } else {
        atualizarMapaRoteiro();
      }
    });
  });

  document.getElementById('btn-recalcular-rota')?.addEventListener('click', () => {
    layerDestaque?.clearLayers();
    atualizarMapaRoteiro();
  });

  document.getElementById('form-rota-custom')?.addEventListener('submit', handleRotaPersonalizada);
}

export function sincronizarAtividadesMapa(novasAtividades) {
  atividadesRef = novasAtividades;
  if (mapa) {
    atualizarSeletorDias();
  }
}

export function redimensionarMapa() {
  if (mapa) {
    setTimeout(() => mapa.invalidateSize(), 120);
  }
}
