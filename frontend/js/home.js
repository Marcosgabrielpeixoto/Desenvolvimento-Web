import { authApi } from './api.js';

async function initHome() {
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
    // Visitante não autenticado — mantém botões padrão de Entrar / Criar conta.
  }
}

initHome();
