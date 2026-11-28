import { escapeHtml, formatarDataBR, calcularNumeroDiaViagem } from './ui.js';
import {
  encontrarDestinoCatalogo,
  listarReferenciasDoDestino,
  buscarReferenciaLocal,
} from './destinos.js';

const geocodeCache = new Map();
const REGEX_NAO_LATINO = /[\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F]/;

let mapa = null;
let tileLayerAtual = null;
let layerMarcadores = null;
let layerRota = null;
let layerDestaque = null;

let viagemRef = null;
let atividadesRef = [];
let modoTransporte = 'driving';
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

function limparConsulta(texto) {
  return String(texto || '')
    .replace(/\s*-\s*[A-Za-z]{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dentroDoBrasil(lat, lon) {
  return lat >= -34.5 && lat <= 6.0 && lon >= -74.5 && lon <= -28.0;
}

async function buscarNoPhoton(consulta, focoCoords = null) {
  try {
    const params = new URLSearchParams({ q: consulta, limit: '5' });
    if (focoCoords) {
      params.set('lat', String(focoCoords.lat));
      params.set('lon', String(focoCoords.lon));
    }
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const features = Array.isArray(data.features) ? data.features : [];

    for (const f of features) {
      const [lon, lat] = f.geometry?.coordinates || [];
      const props = f.properties || {};
      const pais = (props.countrycode || '').toUpperCase();
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (pais && pais !== 'BR') continue;
      if (!dentroDoBrasil(lat, lon)) continue;

      const partes = [props.name, props.street, props.city || props.county, props.state].filter(
        (v) => v && !REGEX_NAO_LATINO.test(v)
      );
      return {
        lat,
        lon,
        displayName: partes.join(', ') || consulta,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function buscarNoNominatim(consulta, viewbox = null) {
  try {
    const params = new URLSearchParams({
      q: consulta,
      format: 'json',
      limit: '3',
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
    if (!Array.isArray(dados) || dados.length === 0) return null;

    const valido = dados.find((d) => dentroDoBrasil(Number(d.lat), Number(d.lon)));
    if (!valido) return null;

    return {
      lat: Number(valido.lat),
      lon: Number(valido.lon),
      displayName: valido.display_name,
    };
  } catch {
    return null;
  }
}

export async function geocodificarLocal(consulta, contextoDestino = '', focoCoords = null) {
  const texto = String(consulta || '').trim();
  if (!texto) return null;

  const chave = `${texto.toLowerCase()}|${contextoDestino.toLowerCase()}`;
  if (geocodeCache.has(chave)) {
    return geocodeCache.get(chave);
  }

  const referencia = buscarReferenciaLocal(texto, contextoDestino);
  if (referencia) {
    geocodeCache.set(chave, referencia);
    return referencia;
  }

  const viewbox = focoCoords
    ? `${focoCoords.lon - 0.6},${focoCoords.lat + 0.6},${focoCoords.lon + 0.6},${focoCoords.lat - 0.6}`
    : null;

  const cidadeLimpa = limparConsulta(contextoDestino);
  const textoLimpo = limparConsulta(texto);
  const consultaComCidade =
    cidadeLimpa && !textoLimpo.toLowerCase().includes(cidadeLimpa.toLowerCase())
      ? `${textoLimpo}, ${cidadeLimpa}, Brasil`
      : `${textoLimpo}, Brasil`;

  let achado = await buscarNoPhoton(consultaComCidade, focoCoords);
  if (!achado) {
    achado = await buscarNoNominatim(consultaComCidade, viewbox);
  }
  if (!achado && textoLimpo !== consultaComCidade) {
    achado = await buscarNoPhoton(`${textoLimpo}, Brasil`, focoCoords);
  }
  if (!achado) {
    achado = await buscarNoNominatim(`${textoLimpo}, Brasil`, null);
  }

  geocodeCache.set(chave, achado);
  return achado;
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
  return window.L.divIcon({
    className: 'tc-map-pin-wrapper',
    html: `<div class="tc-map-pin ${concluida ? 'is-done' : ''}">${numero}</div>`,
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
  const params = new URLSearchParams({
    api: '1',
    origin: `${pontos[0].lat},${pontos[0].lon}`,
    destination: `${pontos[pontos.length - 1].lat},${pontos[pontos.length - 1].lon}`,
    travelmode,
  });
  if (pontos.length > 2) {
    params.set(
      'waypoints',
      pontos
        .slice(1, -1)
        .map((p) => `${p.lat},${p.lon}`)
        .join('|')
    );
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

function preencherReferenciasAutocompletar() {
  const lista = listarReferenciasDoDestino(viagemRef?.destino || '');
  const opcoesHtml = lista
    .map((item) => `<option value="${escapeHtml(item.nome)}">${escapeHtml(item.local)}</option>`)
    .join('');

  const datalistRotas = document.getElementById('mapa-referencias-list');
  if (datalistRotas) {
    datalistRotas.innerHTML = opcoesHtml;
  }

  const datalistAtividade = document.getElementById('atividade-locais-list');
  if (datalistAtividade) {
    datalistAtividade.innerHTML = lista
      .map((item) => `<option value="${escapeHtml(item.local)}">${escapeHtml(item.nome)}</option>`)
      .join('');
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
        Adicione atividades com <strong>Local</strong> preenchido no roteiro ou trace uma rota
        personalizada abaixo usando qualquer endereço ou ponto turístico do Brasil.
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
           Não localizado: ${escapeHtml(naoLocalizadas.join(', '))}.
         </div>`
      : '';

  trechosEl.innerHTML = itensHtml + avisoNaoLocalizadas;
}

function garantirMapaInicializado() {
  const container = document.getElementById('mapa-container');
  if (!container || !window.L) return false;

  if (!mapa) {
    const cat = encontrarDestinoCatalogo(viagemRef?.destino || '');
    const inicial = cat ? [cat.centro.lat, cat.centro.lon] : [-14.235, -51.9253];
    mapa = window.L.map(container, { scrollWheelZoom: true }).setView(inicial, cat ? 12 : 4);
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
    setStatusMapa('Calculando rota entre os pontos...', true);
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
  setStatusMapa('Localizando pontos do roteiro...', true);

  if (!destinoCoords) {
    const cat = encontrarDestinoCatalogo(viagemRef.destino);
    destinoCoords = cat
      ? { lat: cat.centro.lat, lon: cat.centro.lon, displayName: cat.cidade }
      : await geocodificarLocal(viagemRef.destino);
  }

  const filtradas =
    filtroDia === 'todos'
      ? atividadesRef
      : atividadesRef.filter((a) => a.data_atividade === filtroDia);

  const pontosLocalizados = [];
  const naoLocalizadas = [];

  for (const atv of filtradas) {
    const termoLocal = atv.local_atividade?.trim();
    if (!termoLocal) continue;

    let coords = await geocodificarLocal(termoLocal, viagemRef.destino, destinoCoords);
    if (!coords && atv.titulo) {
      coords = await geocodificarLocal(atv.titulo, viagemRef.destino, destinoCoords);
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
    const achado = await geocodificarLocal(
      endereco || nome,
      viagemRef?.destino || '',
      destinoCoords
    );
    if (!achado) {
      setStatusMapa(`Não foi possível encontrar "${nome}" no mapa.`);
      return;
    }
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
          <i class="bi bi-sign-turn-right me-1"></i>Abrir rota no Google Maps
        </a>
      </div>
    `
    )
    .openPopup();

  mapa.setView([pontoLat, pontoLon], 15, { animate: true });
}

async function handleRotaPersonalizada(event) {
  event.preventDefault();
  const origemTxt = document.getElementById('rota-origem')?.value.trim();
  const destinoTxt = document.getElementById('rota-destino')?.value.trim();

  if (!origemTxt || !destinoTxt || !garantirMapaInicializado()) return;

  setStatusMapa('Buscando endereços e calculando rota...', true);

  const [cOrigem, cDestino] = await Promise.all([
    geocodificarLocal(origemTxt, viagemRef.destino, destinoCoords),
    geocodificarLocal(destinoTxt, viagemRef.destino, destinoCoords),
  ]);

  if (!cOrigem || !cDestino) {
    const faltando = !cOrigem && !cDestino ? 'origem e destino' : !cOrigem ? 'a origem' : 'o destino';
    setStatusMapa(`Não foi possível localizar ${faltando}. Tente incluir o nome da cidade ou escolher uma sugestão.`);
    return;
  }

  layerDestaque?.clearLayers();
  await desenharRotaPontos([
    { titulo: cOrigem.nome || origemTxt, local: cOrigem.displayName || origemTxt, lat: cOrigem.lat, lon: cOrigem.lon },
    { titulo: cDestino.nome || destinoTxt, local: cDestino.displayName || destinoTxt, lat: cDestino.lat, lon: cDestino.lon },
  ]);
}

async function handleBuscaLocalMapa(event) {
  event.preventDefault();
  const termo = document.getElementById('mapa-busca-local')?.value.trim();
  if (!termo || !garantirMapaInicializado()) return;

  setStatusMapa(`Buscando "${termo}"...`, true);
  const achado = await geocodificarLocal(termo, viagemRef.destino, destinoCoords);
  if (!achado) {
    setStatusMapa(`Local "${termo}" não encontrado no Brasil. Tente informar cidade ou bairro.`);
    return;
  }
  setStatusMapa('');
  await focarLocalNoMapa({
    nome: achado.nome || termo,
    endereco: achado.displayName || termo,
    lat: achado.lat,
    lon: achado.lon,
  });
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
  document.getElementById('form-busca-mapa')?.addEventListener('submit', handleBuscaLocalMapa);
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
