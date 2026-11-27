/**
 * Módulo de sugestão de lugares turísticos no Brasil.
 * Combina catálogo curado de destinos brasileiros com busca ao vivo
 * restrita ao Brasil no OpenStreetMap (Nominatim + Overpass API).
 */

import { escapeHtml } from './ui.js';
import { geocodificarLocal } from './mapa.js';

const CATEGORIAS_SUGESTAO = {
  turismo: { label: 'Ponto turístico', icon: 'bi-camera-fill', css: 'tc-cat-passeios' },
  natureza: { label: 'Natureza', icon: 'bi-tree-fill', css: 'tc-status-andamento' },
  cultura: { label: 'Cultura', icon: 'bi-bank2', css: 'tc-cat-hospedagem' },
  gastronomia: { label: 'Gastronomia', icon: 'bi-cup-hot-fill', css: 'tc-cat-alimentacao' },
};

// Rejeita nomes em alfabetos não-latinos (japonês, chinês, coreano, cirílico, árabe etc.)
const REGEX_NAO_LATINO = /[\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F]/;

const CATALOGO_DESTINOS_BRASIL = [
  {
    chaves: ['manaus', 'amazonas'],
    lugares: [
      {
        nome: 'Teatro Amazonas',
        categoria: 'cultura',
        local: 'Largo de São Sebastião, Centro, Manaus - AM',
        horario: '09:30',
        descricao: 'Ícone arquitetônico do ciclo da borracha com visitas guiadas e programação cultural.',
        lat: -3.1303,
        lon: -60.0234,
      },
      {
        nome: 'Encontro das Águas',
        categoria: 'natureza',
        local: 'Porto de Manaus, Centro, Manaus - AM',
        horario: '14:00',
        descricao: 'Passeio de barco para observar o encontro dos rios Negro e Solimões.',
        lat: -3.1394,
        lon: -59.9038,
      },
      {
        nome: 'MUSA — Museu da Amazônia',
        categoria: 'natureza',
        local: 'Av. Margarita, Cidade de Deus, Manaus - AM',
        horario: '08:30',
        descricao: 'Jardim botânico com trilhas na floresta e torre de observação de 42 metros.',
        lat: -3.0056,
        lon: -59.9394,
      },
      {
        nome: 'Mercado Municipal Adolpho Lisboa',
        categoria: 'gastronomia',
        local: 'Rua dos Barés, 46, Centro, Manaus - AM',
        horario: '11:30',
        descricao: 'Mercado histórico às margens do Rio Negro com peixes regionais, frutas e artesanato.',
        lat: -3.1397,
        lon: -60.0235,
      },
      {
        nome: 'Praia da Ponta Negra',
        categoria: 'turismo',
        local: 'Av. Coronel Teixeira, Ponta Negra, Manaus - AM',
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
        descricao: 'Passeio ecológico com paisagens amazônicas e observação da natureza.',
        lat: -3.081,
        lon: -58.485,
      },
      {
        nome: 'Feira e Culinária Regional',
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
    chaves: ['parintins'],
    lugares: [
      {
        nome: 'Bumbódromo de Parintins',
        categoria: 'cultura',
        local: 'Av. Nações Unidas, Parintins - AM',
        horario: '10:00',
        descricao: 'Centro cultural palco do tradicional Festival Folclórico de Parintins.',
        lat: -2.6337,
        lon: -56.7327,
      },
      {
        nome: 'Catedral de Nossa Senhora do Carmo',
        categoria: 'cultura',
        local: 'Praça da Catedral, Centro, Parintins - AM',
        horario: '09:00',
        descricao: 'Principal cartão-postal arquitetônico da ilha Tupinambarana.',
        lat: -2.6283,
        lon: -56.7358,
      },
      {
        nome: 'Lago Macurany',
        categoria: 'natureza',
        local: 'Estrada do Macurany, Parintins - AM',
        horario: '15:30',
        descricao: 'Balneários e vista tranquila das águas amazônicas.',
        lat: -2.6515,
        lon: -56.716,
      },
    ],
  },
  {
    chaves: ['rio de janeiro', 'copacabana', 'ipanema', 'rj'],
    lugares: [
      {
        nome: 'Cristo Redentor (Corcovado)',
        categoria: 'turismo',
        local: 'Parque Nacional da Tijuca, Rio de Janeiro - RJ',
        horario: '08:30',
        descricao: 'Uma das Sete Maravilhas do Mundo Moderno com vista de 360° do Rio.',
        lat: -22.9519,
        lon: -43.2105,
      },
      {
        nome: 'Parque Bondinho Pão de Açúcar',
        categoria: 'turismo',
        local: 'Av. Pasteur, 520, Urca, Rio de Janeiro - RJ',
        horario: '16:00',
        descricao: 'Teleférico icônico com vista da Baía de Guanabara ao pôr do sol.',
        lat: -22.9492,
        lon: -43.1545,
      },
      {
        nome: 'Praia de Copacabana e Forte',
        categoria: 'natureza',
        local: 'Av. Atlântica, Copacabana, Rio de Janeiro - RJ',
        horario: '10:00',
        descricao: 'Calçadão clássico, banho de mar e café no Forte de Copacabana.',
        lat: -22.9711,
        lon: -43.1822,
      },
      {
        nome: 'Museu do Amanhã',
        categoria: 'cultura',
        local: 'Praça Mauá, 1, Centro, Rio de Janeiro - RJ',
        horario: '14:00',
        descricao: 'Museu interativo de ciências na revitalizada zona portuária.',
        lat: -22.894,
        lon: -43.1795,
      },
    ],
  },
  {
    chaves: ['sao paulo', 'são paulo', 'sp'],
    lugares: [
      {
        nome: 'Parque Ibirapuera',
        categoria: 'natureza',
        local: 'Av. Pedro Álvares Cabral, Vila Mariana, São Paulo - SP',
        horario: '09:00',
        descricao: 'Maior parque urbano da capital com museus, lagos e ciclovias.',
        lat: -23.5874,
        lon: -46.6576,
      },
      {
        nome: 'MASP — Museu de Arte de São Paulo',
        categoria: 'cultura',
        local: 'Av. Paulista, 1578, Bela Vista, São Paulo - SP',
        horario: '11:00',
        descricao: 'Acervo renomado no coração da Avenida Paulista.',
        lat: -23.5614,
        lon: -46.6559,
      },
      {
        nome: 'Mercado Municipal de São Paulo',
        categoria: 'gastronomia',
        local: 'Rua da Cantareira, 306, Centro, São Paulo - SP',
        horario: '13:00',
        descricao: 'Famoso pelo sanduíche de mortadela, pastel de bacalhau e vitrais históricos.',
        lat: -23.5419,
        lon: -46.6295,
      },
      {
        nome: 'Bairro da Liberdade',
        categoria: 'gastronomia',
        local: 'Praça da Liberdade, São Paulo - SP',
        horario: '16:00',
        descricao: 'Gastronomia, lojas temáticas e feirinha tradicional no centro de São Paulo.',
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
    chaves: ['florianopolis', 'florianópolis', 'floripa'],
    lugares: [
      {
        nome: 'Lagoa da Conceição',
        categoria: 'natureza',
        local: 'Av. das Rendeiras, Florianópolis - SC',
        horario: '10:00',
        descricao: 'Centro turístico da ilha com esportes náuticos, mirantes e restaurantes.',
        lat: -27.6033,
        lon: -48.4638,
      },
      {
        nome: 'Praia da Joaquina e Dunas',
        categoria: 'natureza',
        local: 'Av. Prefeito Acácio Garibaldi São Thiago, Florianópolis - SC',
        horario: '14:00',
        descricao: 'Famosa pelo surfe e pelas dunas de areia para sandboard.',
        lat: -27.6297,
        lon: -48.4494,
      },
      {
        nome: 'Santo Antônio de Lisboa',
        categoria: 'gastronomia',
        local: 'Rua Quinze de Novembro, Florianópolis - SC',
        horario: '17:30',
        descricao: 'Bairro açoriano histórico conhecido pela rota gastronômica de ostras e pôr do sol.',
        lat: -27.5082,
        lon: -48.5192,
      },
    ],
  },
  {
    chaves: ['fortaleza', 'ceara', 'ceará'],
    lugares: [
      {
        nome: 'Avenida Beira Mar e Feirinha',
        categoria: 'turismo',
        local: 'Av. Beira Mar, Meireles, Fortaleza - CE',
        horario: '17:00',
        descricao: 'Calçadão movimentado, artesanato cearense e passeio de jangada.',
        lat: -3.726,
        lon: -38.4936,
      },
      {
        nome: 'Praia do Futuro',
        categoria: 'natureza',
        local: 'Av. Clóvis Arrais Maia, Fortaleza - CE',
        horario: '10:00',
        descricao: 'Extensa faixa de areia com barracas estruturadas e culinária praiana.',
        lat: -3.7495,
        lon: -38.454,
      },
      {
        nome: 'Centro Dragão do Mar de Arte e Cultura',
        categoria: 'cultura',
        local: 'Rua Dragão do Mar, 81, Praia de Iracema, Fortaleza - CE',
        horario: '15:00',
        descricao: 'Museus, planetário, cinema e vida cultural na Praia de Iracema.',
        lat: -3.7212,
        lon: -38.5205,
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
    chaves: ['recife', 'olinda', 'pernambuco'],
    lugares: [
      {
        nome: 'Marco Zero e Recife Antigo',
        categoria: 'cultura',
        local: 'Praça Rio Branco, Recife - PE',
        horario: '09:30',
        descricao: 'Centro histórico com o Parque das Esculturas de Francisco Brennand e armazéns.',
        lat: -8.0631,
        lon: -34.8711,
      },
      {
        nome: 'Praia de Boa Viagem',
        categoria: 'natureza',
        local: 'Av. Boa Viagem, Recife - PE',
        horario: '15:00',
        descricao: 'Principal orla do Recife com piscinas naturais na maré baixa.',
        lat: -8.1282,
        lon: -34.8992,
      },
      {
        nome: 'Alto da Sé (Olinda)',
        categoria: 'turismo',
        local: 'Rua Bispo Coutinho, Carmo, Olinda - PE',
        horario: '16:30',
        descricao: 'Ladeiras históricas coloridas, tapioca artesanal e vista para o mar.',
        lat: -8.014,
        lon: -34.8495,
      },
    ],
  },
  {
    chaves: ['brasilia', 'brasília', 'df'],
    lugares: [
      {
        nome: 'Catedral Metropolitana de Brasília',
        categoria: 'cultura',
        local: 'Esplanada dos Ministérios, Brasília - DF',
        horario: '09:30',
        descricao: 'Obra icônica de Oscar Niemeyer com vitrais assinados por Marianne Peretti.',
        lat: -15.7983,
        lon: -47.8756,
      },
      {
        nome: 'Praça dos Três Poderes',
        categoria: 'turismo',
        local: 'Zona Cívico-Administrativa, Brasília - DF',
        horario: '11:00',
        descricao: 'Congresso Nacional, Palácio do Planalto e STF em um só conjunto arquitetônico.',
        lat: -15.8011,
        lon: -47.8613,
      },
      {
        nome: 'Pontão do Lago Sul',
        categoria: 'gastronomia',
        local: 'SHIS Ql 10, Lago Sul, Brasília - DF',
        horario: '17:30',
        descricao: 'Restaurantes à beira do Lago Paranoá e um dos melhores pores do sol da capital.',
        lat: -15.8266,
        lon: -47.8712,
      },
    ],
  },
  {
    chaves: ['curitiba', 'parana', 'paraná'],
    lugares: [
      {
        nome: 'Jardim Botânico de Curitiba',
        categoria: 'natureza',
        local: 'Rua Eng. Ostoja Roguski, Curitiba - PR',
        horario: '09:30',
        descricao: 'Estufa de vidro icônica e jardins em estilo francês.',
        lat: -25.4429,
        lon: -49.2397,
      },
      {
        nome: 'Ópera de Arame',
        categoria: 'cultura',
        local: 'Rua João Gava, 920, Abranches, Curitiba - PR',
        horario: '14:00',
        descricao: 'Teatro de estrutura metálica tubular rodeado por lago e vegetação.',
        lat: -25.3847,
        lon: -49.2764,
      },
      {
        nome: 'Museu Oscar Niemeyer (Museu do Olho)',
        categoria: 'cultura',
        local: 'Rua Marechal Hermes, 999, Centro Cívico, Curitiba - PR',
        horario: '16:00',
        descricao: 'Referência em artes visuais, arquitetura e design no Brasil.',
        lat: -25.4103,
        lon: -49.267,
      },
    ],
  },
  {
    chaves: ['fernando de noronha', 'noronha'],
    lugares: [
      {
        nome: 'Baía do Sancho',
        categoria: 'natureza',
        local: 'Parque Nacional Marinho, Fernando de Noronha - PE',
        horario: '09:00',
        descricao: 'Águas cristalinas para mergulho livre entre falésias e mirantes.',
        lat: -3.8546,
        lon: -32.4437,
      },
      {
        nome: 'Mirante dos Golfinhos',
        categoria: 'natureza',
        local: 'Baía dos Golfinhos, Fernando de Noronha - PE',
        horario: '07:00',
        descricao: 'Ponto de observação dos golfinhos-rotadores no início da manhã.',
        lat: -3.8602,
        lon: -32.4494,
      },
      {
        nome: 'Forte de Nossa Senhora dos Remédios',
        categoria: 'turismo',
        local: 'Vila dos Remédios, Fernando de Noronha - PE',
        horario: '17:00',
        descricao: 'Fortaleza histórica com vista panorâmica para o Morro do Pico ao pôr do sol.',
        lat: -3.8386,
        lon: -32.4084,
      },
    ],
  },
  {
    chaves: ['lencois', 'lençóis', 'barreirinhas', 'maranhao', 'maranhão'],
    lugares: [
      {
        nome: 'Circuito Lagoa Azul e Lagoa Bonita',
        categoria: 'natureza',
        local: 'Parque Nacional dos Lençóis Maranhenses, Barreirinhas - MA',
        horario: '14:00',
        descricao: 'Passeio em 4x4 pelas dunas brancas e lagoas cristalinas com pôr do sol.',
        lat: -2.533,
        lon: -43.128,
      },
      {
        nome: 'Passeio de Voadeira pelo Rio Preguiças',
        categoria: 'turismo',
        local: 'Beira-Rio, Barreirinhas - MA',
        horario: '08:30',
        descricao: 'Navegação passando por Vassouras, Mandacaru e praia de Caburé.',
        lat: -2.747,
        lon: -42.826,
      },
    ],
  },
  {
    chaves: ['bonito', 'mato grosso do sul'],
    lugares: [
      {
        nome: 'Gruta do Lago Azul',
        categoria: 'natureza',
        local: 'Rodovia MS-382, Bonito - MS',
        horario: '08:30',
        descricao: 'Caverna monumental com lago subterrâneo de coloração azul intensa.',
        lat: -21.145,
        lon: -56.591,
      },
      {
        nome: 'Flutuação no Rio da Prata',
        categoria: 'natureza',
        local: 'BR-267, km 512, Bonito - MS',
        horario: '13:30',
        descricao: 'Flutuação em águas transparentes com cardumes de peixes.',
        lat: -21.448,
        lon: -56.437,
      },
    ],
  },
];

const DESTAQUES_BRASIL_FALLBACK = [
  CATALOGO_DESTINOS_BRASIL[0].lugares[0], // Teatro Amazonas
  CATALOGO_DESTINOS_BRASIL[4].lugares[0], // Cristo Redentor
  CATALOGO_DESTINOS_BRASIL[6].lugares[0], // Cataratas do Iguaçu
  CATALOGO_DESTINOS_BRASIL[7].lugares[0], // Pelourinho
  CATALOGO_DESTINOS_BRASIL[14].lugares[0], // Baía do Sancho
  CATALOGO_DESTINOS_BRASIL[15].lugares[0], // Lençóis Maranhenses
].map((l, idx) => ({ ...l, id: `br-fallback-${idx}`, origem: 'curado' }));

let sugestoesCarregadas = [];
let filtroCategoriaAtual = 'todas';
let buscaLiveExecutada = false;
let destinoAtual = '';
let usandoFallbackBrasil = false;
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
  for (const entrada of CATALOGO_DESTINOS_BRASIL) {
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
              ? `Opção gastronômica localizada em ${destino}.`
              : categoria === 'natureza'
                ? `Área verde e lazer ao ar livre em ${destino}.`
                : categoria === 'cultura'
                  ? `Espaço cultural e histórico em ${destino}.`
                  : `Ponto turístico recomendado em ${destino}.`;

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
    sugestoesCarregadas = [...DESTAQUES_BRASIL_FALLBACK];
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

  if (sugestoesCarregadas.length === 0) {
    carregarSugestoesLive(false);
  }
}

export function aoAbrirAbaSugestoes() {
  if (sugestoesCarregadas.length === 0 && !buscaLiveExecutada) {
    carregarSugestoesLive(false);
  }
}
