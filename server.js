import express from 'express';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const app = express();
const pasta = fileURLToPath(new URL('.', import.meta.url));
const configLocal = new URL('../src/FornoERua.App/FornoERua.App/FornoERua.App/Config/appsettings.json', import.meta.url);
let configuracao = {};
try {
  if (existsSync(configLocal)) configuracao = JSON.parse(readFileSync(configLocal, 'utf8').replace(/^\uFEFF/, ''));
} catch {
  throw new Error('Configuração local inválida. Confira Config/appsettings.json.');
}
const api = process.env.FORNOERUA_API_URL || configuracao.ApiSettings?.BaseUrl || 'http://127.0.0.1:5050';
const destino = new URL(api);
if (destino.protocol !== 'http:' || destino.hostname !== '127.0.0.1' || destino.username || destino.password) {
  throw new Error('Configure a API local com http://127.0.0.1:5050/.');
}
const porta = Number(process.env.PORT || 3000);

app.use('/api', express.json({ limit: '32kb' }));

async function encaminhar(req, res) {
  const origem = req.get('Origin');
  if (origem && origem !== `http://127.0.0.1:${porta}` && origem !== `http://localhost:${porta}`) {
    return res.status(403).json({ erro: 'Origem não autorizada.' });
  }
  if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ erro: 'Envie o corpo como application/json.' });
  }

  const headers = {};
  if (['POST', 'PUT'].includes(req.method)) headers['Content-Type'] = 'application/json';
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.get('Idempotency-Key')) headers['Idempotency-Key'] = req.get('Idempotency-Key');

  try {
    const caminho = ['/api/produtos', '/api/pedidos'].includes(req.path) ? req.path.slice(4) : req.path;
    const resposta = await fetch(new URL(caminho, api), {
      method: req.method,
      headers,
      body: ['POST', 'PUT'].includes(req.method) ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    const cookies = resposta.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies.map(cookie => req.secure ? cookie + '; Secure' : cookie));
    const espera = resposta.headers.get('Retry-After');
    if (espera) res.setHeader('Retry-After', espera);
    res.setHeader('Cache-Control', 'no-store');
    res.status(resposta.status).type('json').send(await resposta.text());
  } catch {
    res.status(502).json({ erro: 'Servidor indisponível. Verifique se o sistema C# está aberto.' });
  }
}

app.get('/api/produtos', encaminhar);
app.get('/api/saude', encaminhar);
app.post('/api/pedidos', encaminhar);
app.post('/api/atendimento', encaminhar);
app.post('/api/cadastro', encaminhar);
app.post('/api/login', encaminhar);
app.get('/api/sessao', encaminhar);
app.post('/api/sair', encaminhar);
app.get('/api/perfil', encaminhar);
app.put('/api/perfil', encaminhar);
app.get('/api/meus-pedidos', encaminhar);

app.get(['/', '/index.html'], (_, res) => res.sendFile('index.html', { root: pasta }));
for (const diretorio of ['css', 'img', 'js']) {
  app.use('/' + diretorio, express.static(pasta + diretorio));
}

app.use((erro, req, res, next) => {
  const status = erro.status || 500;
  res.status(status).json({ erro: status === 413 ? 'Mensagem muito grande.' : 'Não foi possível ler a solicitação.' });
});

app.listen(porta, '127.0.0.1', () => {
  console.log(`Site em http://127.0.0.1:${porta}`);
});
