/**
 * Inicialização síncrona do tema (claro/escuro) para evitar flash visual
 * e gerenciamento do botão de alternância em todas as telas.
 */
(function () {
  const STORAGE_KEY = 'tc_theme';

  function obterTemaInicial() {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo === 'dark' || salvo === 'light') {
        return salvo;
      }
    } catch {
      // Ignora caso storage não esteja disponível
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function atualizarBotoes(tema) {
    const escuro = tema === 'dark';
    document.querySelectorAll('.tc-theme-toggle').forEach((btn) => {
      btn.setAttribute('aria-pressed', escuro ? 'true' : 'false');
      btn.setAttribute(
        'aria-label',
        escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'
      );
      btn.setAttribute('title', escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro');
      btn.innerHTML = escuro
        ? '<i class="bi bi-sun-fill"></i>'
        : '<i class="bi bi-moon-stars-fill"></i>';
    });
  }

  function aplicarTema(tema, persistir) {
    document.documentElement.setAttribute('data-bs-theme', tema);
    if (persistir) {
      try {
        localStorage.setItem(STORAGE_KEY, tema);
      } catch {
        // Ignora erro de storage
      }
    }
    atualizarBotoes(tema);
  }

  // Aplica imediatamente antes da renderização do body
  const temaInicial = obterTemaInicial();
  document.documentElement.setAttribute('data-bs-theme', temaInicial);

  document.addEventListener('DOMContentLoaded', () => {
    atualizarBotoes(document.documentElement.getAttribute('data-bs-theme') || temaInicial);

    document.querySelectorAll('.tc-theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const atual = document.documentElement.getAttribute('data-bs-theme');
        const proximo = atual === 'dark' ? 'light' : 'dark';
        aplicarTema(proximo, true);
      });
    });
  });

  window.TripCraftTheme = {
    get: () => document.documentElement.getAttribute('data-bs-theme') || 'light',
    set: (tema) => aplicarTema(tema === 'dark' ? 'dark' : 'light', true),
    toggle: () => {
      const atual = document.documentElement.getAttribute('data-bs-theme');
      aplicarTema(atual === 'dark' ? 'light' : 'dark', true);
    },
  };
})();
