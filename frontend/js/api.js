export class ApiError extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo || 'ERRO_REQUISICAO';
    this.mensagem = mensagem || 'Ocorreu um erro ao processar a solicitação.';
  }
}

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const config = {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  };

  if (body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, config);
  } catch {
    throw new ApiError(
      0,
      'ERRO_CONEXAO',
      'Não foi possível conectar ao servidor. Verifique se o back-end está em execução.'
    );
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const codigo = data?.erro?.codigo || `HTTP_${response.status}`;
    const mensagem =
      data?.erro?.mensagem ||
      (response.status === 401
        ? 'Sua sessão expirou ou você não está autenticado.'
        : 'Não foi possível concluir a operação.');
    throw new ApiError(response.status, codigo, mensagem);
  }

  return data;
}

export const authApi = {
  cadastro: (payload) => request('/api/auth/cadastro', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
};

export const viagensApi = {
  listar: (busca = '') => {
    const termo = busca.trim();
    const qs = termo ? `?busca=${encodeURIComponent(termo)}` : '';
    return request(`/api/viagens${qs}`);
  },
  buscarPorId: (id) => request(`/api/viagens/${encodeURIComponent(id)}`),
  criar: (payload) => request('/api/viagens', { method: 'POST', body: payload }),
  atualizar: (id, payload) =>
    request(`/api/viagens/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  excluir: (id) => request(`/api/viagens/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const atividadesApi = {
  listarPorViagem: (viagemId) =>
    request(`/api/viagens/${encodeURIComponent(viagemId)}/atividades`),
  criar: (viagemId, payload) =>
    request(`/api/viagens/${encodeURIComponent(viagemId)}/atividades`, {
      method: 'POST',
      body: payload,
    }),
  atualizar: (id, payload) =>
    request(`/api/atividades/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  alterarConclusao: (id, concluida) =>
    request(`/api/atividades/${encodeURIComponent(id)}/conclusao`, {
      method: 'PATCH',
      body: { concluida: Boolean(concluida) },
    }),
  excluir: (id) => request(`/api/atividades/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const despesasApi = {
  listarPorViagem: (viagemId) =>
    request(`/api/viagens/${encodeURIComponent(viagemId)}/despesas`),
  criar: (viagemId, payload) =>
    request(`/api/viagens/${encodeURIComponent(viagemId)}/despesas`, {
      method: 'POST',
      body: payload,
    }),
  atualizar: (id, payload) =>
    request(`/api/despesas/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  excluir: (id) => request(`/api/despesas/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  obterResumo: (viagemId) =>
    request(`/api/viagens/${encodeURIComponent(viagemId)}/resumo`),
};
