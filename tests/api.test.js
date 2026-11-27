const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const pool = require('../src/config/db');

let server;
let baseUrl;
const usuariosCriados = [];

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (cookie) {
    headers.Cookie = cookie;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  const setCookie = response.headers.get('set-cookie');
  return {
    status: response.status,
    data,
    cookie: setCookie ? setCookie.split(';')[0] : null,
  };
}

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  for (const id of usuariosCriados) {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('Fluxo completo de API (CT01 a CT23)', async () => {
  const ts = Date.now();
  const email1 = `ana_${ts}@example.com`;
  const email2 = `bruno_${ts}@example.com`;

  // CT05: Acessar rota privada sem login -> 401
  const semLogin = await req('/api/viagens');
  assert.equal(semLogin.status, 401);

  // CT01: Cadastrar usuário com dados válidos -> 201
  const cad1 = await req('/api/auth/cadastro', {
    method: 'POST',
    body: { nome: 'Ana Silva', email: email1, senha: 'exemplo123' },
  });
  assert.equal(cad1.status, 201);
  assert.equal(cad1.data.email, email1);
  assert.equal(cad1.data.senha, undefined);
  assert.equal(cad1.data.senha_hash, undefined);
  usuariosCriados.push(cad1.data.id);

  // CT02: Cadastrar e-mail já existente (case-insensitive) -> 409
  const cadDup = await req('/api/auth/cadastro', {
    method: 'POST',
    body: { nome: 'Outra Ana', email: email1.toUpperCase(), senha: 'exemplo123' },
  });
  assert.equal(cadDup.status, 409);

  // CT04: Login com senha incorreta -> 401
  const loginErrado = await req('/api/auth/login', {
    method: 'POST',
    body: { email: email1, senha: 'errada' },
  });
  assert.equal(loginErrado.status, 401);

  // CT03: Login com credenciais corretas -> 200
  const login1 = await req('/api/auth/login', {
    method: 'POST',
    body: { email: email1, senha: 'exemplo123' },
  });
  assert.equal(login1.status, 200);
  const cookie1 = login1.cookie;
  assert.ok(cookie1);

  const me = await req('/api/auth/me', { cookie: cookie1 });
  assert.equal(me.status, 200);
  assert.equal(me.data.id, cad1.data.id);

  // Cadastrar segundo usuário para testar isolamento
  const cad2 = await req('/api/auth/cadastro', {
    method: 'POST',
    body: { nome: 'Bruno', email: email2, senha: 'exemplo123' },
  });
  assert.equal(cad2.status, 201);
  usuariosCriados.push(cad2.data.id);
  const cookie2 = cad2.cookie;

  // CT07: Viagem com data final anterior à inicial -> 400
  const viagemDataErrada = await req('/api/viagens', {
    method: 'POST',
    cookie: cookie1,
    body: {
      titulo: 'Erro',
      destino: 'Manaus',
      data_inicio: '2026-12-15',
      data_fim: '2026-12-10',
      orcamento: 1000,
    },
  });
  assert.equal(viagemDataErrada.status, 400);

  // CT08: Viagem com orçamento negativo -> 400
  const viagemOrcErrado = await req('/api/viagens', {
    method: 'POST',
    cookie: cookie1,
    body: {
      titulo: 'Erro',
      destino: 'Manaus',
      data_inicio: '2026-12-10',
      data_fim: '2026-12-15',
      orcamento: -50,
    },
  });
  assert.equal(viagemOrcErrado.status, 400);

  // CT06: Cadastrar viagem com dados válidos -> 201
  const vCriada = await req('/api/viagens', {
    method: 'POST',
    cookie: cookie1,
    body: {
      titulo: 'Férias em Manaus',
      destino: 'Manaus - AM',
      data_inicio: '2026-12-10',
      data_fim: '2026-12-15',
      orcamento: 2000,
      descricao: 'Férias',
    },
  });
  assert.equal(vCriada.status, 201);
  const viagemId = vCriada.data.id;
  assert.equal(vCriada.data.status, 'Planejada');

  // CT11: Consultar viagem de outro usuário -> 404
  const vOutro = await req(`/api/viagens/${viagemId}`, { cookie: cookie2 });
  assert.equal(vOutro.status, 404);

  // CT23: Consultar resumo de viagem sem despesas -> total_gasto = 0
  const resumoVazio = await req(`/api/viagens/${viagemId}/resumo`, { cookie: cookie1 });
  assert.equal(resumoVazio.status, 200);
  assert.equal(resumoVazio.data.total_gasto, 0);
  assert.equal(resumoVazio.data.saldo_disponivel, 2000);

  // CT13: Cadastrar atividade fora do período -> 400
  const ativFora = await req(`/api/viagens/${viagemId}/atividades`, {
    method: 'POST',
    cookie: cookie1,
    body: {
      titulo: 'Fora',
      data_atividade: '2026-12-20',
      horario: '09:00',
    },
  });
  assert.equal(ativFora.status, 400);

  // CT12: Cadastrar atividade dentro do período -> 201
  const ativCriada = await req(`/api/viagens/${viagemId}/atividades`, {
    method: 'POST',
    cookie: cookie1,
    body: {
      titulo: 'Passeio',
      data_atividade: '2026-12-11',
      horario: '09:00',
      local_atividade: 'Centro',
      descricao: null,
    },
  });
  assert.equal(ativCriada.status, 201);
  const ativId = ativCriada.data.id;

  // CT22: Alterar datas da viagem de modo incompatível com atividades -> 409
  const viagemConflito = await req(`/api/viagens/${viagemId}`, {
    method: 'PUT',
    cookie: cookie1,
    body: {
      titulo: 'Férias em Manaus',
      destino: 'Manaus - AM',
      data_inicio: '2026-12-12',
      data_fim: '2026-12-15',
      orcamento: 2000,
    },
  });
  assert.equal(viagemConflito.status, 409);

  // CT14: Editar atividade e marcar conclusão -> 200
  const ativEdit = await req(`/api/atividades/${ativId}`, {
    method: 'PUT',
    cookie: cookie1,
    body: {
      titulo: 'Passeio no Teatro',
      data_atividade: '2026-12-11',
      horario: '10:00',
      local_atividade: 'Centro',
    },
  });
  assert.equal(ativEdit.status, 200);

  const ativConc = await req(`/api/atividades/${ativId}/conclusao`, {
    method: 'PATCH',
    cookie: cookie1,
    body: { concluida: true },
  });
  assert.equal(ativConc.status, 200);
  assert.equal(ativConc.data.concluida, true);

  // CT17: Registrar despesa com valor negativo -> 400
  const despNeg = await req(`/api/viagens/${viagemId}/despesas`, {
    method: 'POST',
    cookie: cookie1,
    body: {
      descricao: 'Erro',
      categoria: 'alimentacao',
      valor: -10,
      data_despesa: '2026-12-11',
    },
  });
  assert.equal(despNeg.status, 400);

  // CT16 e CT19: Registrar despesas acima do orçamento -> 201 e saldo negativo
  const desp1 = await req(`/api/viagens/${viagemId}/despesas`, {
    method: 'POST',
    cookie: cookie1,
    body: {
      descricao: 'Pacote Hotel',
      categoria: 'hospedagem',
      valor: 2500,
      data_despesa: '2026-12-11',
    },
  });
  assert.equal(desp1.status, 201);
  const despId = desp1.data.id;

  const resumoExcedido = await req(`/api/viagens/${viagemId}/resumo`, { cookie: cookie1 });
  assert.equal(resumoExcedido.status, 200);
  assert.equal(resumoExcedido.data.total_gasto, 2500);
  assert.equal(resumoExcedido.data.saldo_disponivel, -500);

  // CT21: Editar despesa de outro usuário -> 404
  const despOutro = await req(`/api/despesas/${despId}`, {
    method: 'PUT',
    cookie: cookie2,
    body: {
      descricao: 'Hack',
      categoria: 'outros',
      valor: 10,
    },
  });
  assert.equal(despOutro.status, 404);

  // CT18: Excluir despesa -> saldo recalculado
  const despDel = await req(`/api/despesas/${despId}`, {
    method: 'DELETE',
    cookie: cookie1,
  });
  assert.equal(despDel.status, 204);

  const resumoRecalc = await req(`/api/viagens/${viagemId}/resumo`, { cookie: cookie1 });
  assert.equal(resumoRecalc.data.total_gasto, 0);
  assert.equal(resumoRecalc.data.saldo_disponivel, 2000);

  // CT15: Excluir atividade -> 204
  const ativDel = await req(`/api/atividades/${ativId}`, {
    method: 'DELETE',
    cookie: cookie1,
  });
  assert.equal(ativDel.status, 204);

  // CT09: Editar viagem própria -> 200
  const vEdit = await req(`/api/viagens/${viagemId}`, {
    method: 'PUT',
    cookie: cookie1,
    body: {
      titulo: 'Manaus Editada',
      destino: 'Manaus - AM',
      data_inicio: '2026-12-10',
      data_fim: '2026-12-16',
      orcamento: 2200,
    },
  });
  assert.equal(vEdit.status, 200);
  assert.equal(vEdit.data.titulo, 'Manaus Editada');

  // CT10: Excluir viagem -> 204
  const vDel = await req(`/api/viagens/${viagemId}`, {
    method: 'DELETE',
    cookie: cookie1,
  });
  assert.equal(vDel.status, 204);

  // Logout -> 204
  const logout1 = await req('/api/auth/logout', { method: 'POST', cookie: cookie1 });
  assert.equal(logout1.status, 204);
});
