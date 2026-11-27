import { authApi } from './api.js';
import { exibirAlertaInline, setBotaoCarregando, salvarFlashMessage } from './ui.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const alertEl = document.getElementById('auth-alert');
const headingEl = document.getElementById('auth-heading');
const subheadingEl = document.getElementById('auth-subheading');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabCadastroBtn = document.getElementById('tab-cadastro-btn');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');
const btnLogin = document.getElementById('btn-login');
const btnCadastro = document.getElementById('btn-cadastro');

function obterDestinoPosLogin() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return '/dashboard.html';
}

function atualizarCabecalhoAba(aba) {
  exibirAlertaInline(alertEl, '');
  if (aba === 'cadastro') {
    headingEl.textContent = 'Crie sua conta no TripCraft';
    subheadingEl.textContent = 'Cadastre-se gratuitamente para organizar suas viagens e despesas.';
  } else {
    headingEl.textContent = 'Acesse sua conta';
    subheadingEl.textContent = 'Gerencie suas viagens, roteiros e despesas em um só lugar.';
  }
}

function configurarAlternanciaSenhas() {
  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      btn.innerHTML = mostrar ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  });
}

async function verificarSessaoExistente() {
  try {
    await authApi.me();
    window.location.replace(obterDestinoPosLogin());
  } catch {
    // Não autenticado, permanece na página de auth.
  }
}

tabLoginBtn?.addEventListener('shown.bs.tab', () => atualizarCabecalhoAba('login'));
tabCadastroBtn?.addEventListener('shown.bs.tab', () => atualizarCabecalhoAba('cadastro'));

formLogin?.addEventListener('submit', async (event) => {
  event.preventDefault();
  exibirAlertaInline(alertEl, '');

  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  if (!email || !senha) {
    exibirAlertaInline(alertEl, 'Informe seu e-mail e sua senha para entrar.');
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    exibirAlertaInline(alertEl, 'Informe um endereço de e-mail válido.');
    return;
  }

  setBotaoCarregando(btnLogin, true, 'Entrando...');
  try {
    const usuario = await authApi.login({ email, senha });
    salvarFlashMessage(`Bem-vindo(a), ${usuario.nome}!`, 'success');
    window.location.replace(obterDestinoPosLogin());
  } catch (err) {
    exibirAlertaInline(alertEl, err.mensagem || 'Não foi possível fazer login.');
    setBotaoCarregando(btnLogin, false);
  }
});

formCadastro?.addEventListener('submit', async (event) => {
  event.preventDefault();
  exibirAlertaInline(alertEl, '');

  const nome = document.getElementById('cadastro-nome').value.trim();
  const email = document.getElementById('cadastro-email').value.trim();
  const senha = document.getElementById('cadastro-senha').value;
  const confirmarSenha = document.getElementById('cadastro-confirmar-senha').value;

  if (!nome || !email || !senha || !confirmarSenha) {
    exibirAlertaInline(alertEl, 'Preencha todos os campos obrigatórios do cadastro.');
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    exibirAlertaInline(alertEl, 'Informe um endereço de e-mail válido.');
    return;
  }

  if (senha.length < 6) {
    exibirAlertaInline(alertEl, 'A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  if (senha !== confirmarSenha) {
    exibirAlertaInline(alertEl, 'A confirmação de senha não confere.');
    return;
  }

  setBotaoCarregando(btnCadastro, true, 'Criando conta...');
  try {
    const usuario = await authApi.cadastro({ nome, email, senha });
    salvarFlashMessage(`Conta criada com sucesso! Bem-vindo(a), ${usuario.nome}.`, 'success');
    window.location.replace(obterDestinoPosLogin());
  } catch (err) {
    exibirAlertaInline(alertEl, err.mensagem || 'Não foi possível criar a conta.');
    setBotaoCarregando(btnCadastro, false);
  }
});

function initAuth() {
  configurarAlternanciaSenhas();

  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'cadastro' && tabCadastroBtn) {
    window.bootstrap.Tab.getOrCreateInstance(tabCadastroBtn).show();
    atualizarCabecalhoAba('cadastro');
  }

  verificarSessaoExistente();
}

initAuth();
