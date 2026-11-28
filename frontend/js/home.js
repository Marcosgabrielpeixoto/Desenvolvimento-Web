import { authApi } from './api.js';

const VIDEOS_TURISTICOS = [
  {
    nome: 'Lençóis Maranhenses — MA',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Len%C3%A7%C3%B3is_Maranhenses_-_Por_do_Sol_nas_dunas.webm',
  },
  {
    nome: 'Cataratas do Iguaçu — PR',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Garganta_del_Diablo_en_el_Iguaz%C3%BA.webm',
  },
  {
    nome: 'Fernando de Noronha — PE',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Rotadorvideo.webm',
  },
  {
    nome: 'Praia de Copacabana — RJ',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Rio_de_Janeiro%2C_Copacabana_Beach%2C_samba.webm',
  },
];

function initHeroVideo() {
  const videoEl = document.getElementById('hero-bg-video');
  const labelEl = document.getElementById('hero-video-label');
  const btnPrev = document.getElementById('btn-video-prev');
  const btnNext = document.getElementById('btn-video-next');
  const btnToggle = document.getElementById('btn-video-toggle');

  if (!videoEl) return;

  let indice = 0;
  let pausadoManual = false;
  let falhasConsecutivas = 0;
  let autoTimer = null;

  function agendarTrocaAutomatica() {
    clearTimeout(autoTimer);
    if (pausadoManual) return;
    autoTimer = setTimeout(() => {
      carregarVideo(indice + 1);
    }, 12000);
  }

  function atualizarBotaoPlayPause() {
    if (!btnToggle) return;
    if (pausadoManual || videoEl.paused) {
      btnToggle.innerHTML = '<i class="bi bi-play-fill"></i>';
      btnToggle.title = 'Reproduzir vídeo';
    } else {
      btnToggle.innerHTML = '<i class="bi bi-pause-fill"></i>';
      btnToggle.title = 'Pausar vídeo';
    }
  }

  function carregarVideo(novoIndice) {
    indice = (novoIndice + VIDEOS_TURISTICOS.length) % VIDEOS_TURISTICOS.length;
    const item = VIDEOS_TURISTICOS[indice];

    videoEl.classList.remove('is-ready');
    if (labelEl) {
      labelEl.textContent = item.nome;
    }

    videoEl.src = item.url;
    videoEl.load();

    if (!pausadoManual) {
      const promessa = videoEl.play();
      if (promessa && typeof promessa.catch === 'function') {
        promessa.catch(() => {
          atualizarBotaoPlayPause();
        });
      }
    }
    agendarTrocaAutomatica();
  }

  videoEl.addEventListener('loadeddata', () => {
    falhasConsecutivas = 0;
    videoEl.classList.add('is-ready');
    atualizarBotaoPlayPause();
  });

  videoEl.addEventListener('ended', () => {
    if (!pausadoManual) {
      carregarVideo(indice + 1);
    }
  });

  videoEl.addEventListener('error', () => {
    falhasConsecutivas += 1;
    if (falhasConsecutivas < VIDEOS_TURISTICOS.length) {
      carregarVideo(indice + 1);
    }
  });

  btnPrev?.addEventListener('click', () => carregarVideo(indice - 1));
  btnNext?.addEventListener('click', () => carregarVideo(indice + 1));

  btnToggle?.addEventListener('click', () => {
    if (videoEl.paused) {
      pausadoManual = false;
      videoEl.play().catch(() => {});
      agendarTrocaAutomatica();
    } else {
      pausadoManual = true;
      clearTimeout(autoTimer);
      videoEl.pause();
    }
    atualizarBotaoPlayPause();
  });

  carregarVideo(0);
}

async function initHome() {
  initHeroVideo();

  try {
    const usuario = await authApi.me();
    if (!usuario) return;

    document.getElementById('home-nav-guest')?.classList.add('d-none');
    const navAuth = document.getElementById('home-nav-auth');
    if (navAuth) {
      navAuth.classList.remove('d-none');
      navAuth.classList.add('d-flex');
    }

    const nameEl = document.getElementById('home-user-name');
    if (nameEl) {
      nameEl.textContent = usuario.nome;
    }

    document.getElementById('hero-cta-guest')?.classList.add('d-none');
    const heroAuth = document.getElementById('hero-cta-auth');
    if (heroAuth) {
      heroAuth.classList.remove('d-none');
      heroAuth.classList.add('d-flex');
    }
  } catch {
  }
}

initHome();
