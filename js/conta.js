async function requisicaoConta(caminho, opcoes = {}) {
  if (location.protocol === 'file:') {
    const erro = new Error('Abra o site em http://127.0.0.1:3000, com o servidor do projeto iniciado.');
    erro.status = 503;
    throw erro;
  }
  let resposta;
  try {
    resposta = await fetch(API + caminho, {
    ...opcoes,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12000),
    });
  } catch {
    const erro = new Error('Não foi possível acessar o servidor do site. Confira se ele está em execução.');
    erro.status = 503;
    throw erro;
  }
  if (resposta.status !== 204 && !resposta.headers.get('content-type')?.includes('application/json')) {
    const erro = new Error('Este endereço não oferece a API do projeto. Para a demonstração, abra http://127.0.0.1:3000.');
    erro.status = 503;
    throw erro;
  }
  const dados = resposta.status === 204 ? null : await resposta.json();
  if (!resposta.ok) {
    const erro = new Error(dados?.erro || 'Não foi possível concluir a solicitação.');
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

function limparConta() {
  estado.usuario = null;
  estado.cliente = {};
  estado.pedidos = null;
  estado.erroPedidos = '';
  ultimaTentativa = undefined;
}

async function carregarSessao() {
  try {
    const dados = await requisicaoConta('/sessao');
    estado.usuario = dados.usuario;
    estado.cliente.nome ||= dados.usuario.nome;
    estado.cliente.telefone ||= aplicarMascara('telefone', dados.usuario.telefone);
  } catch {
    limparConta();
  } finally {
    estado.carregandoSessao = false;
    if (estado.usuario && ['Login', 'Cadastro'].includes(estado.pagina)) {
      navegar('Perfil');
    } else {
      if (['Login', 'Cadastro', 'Perfil', 'Pedidos'].includes(estado.pagina)) render();
      else atualizarCabecalho();
      if (estado.usuario && estado.pagina === 'Pedidos') carregarPedidos();
    }
  }
}

async function autenticar(form) {
  if (estado.autenticando) return;
  const dados = Object.fromEntries(new FormData(form));
  const cadastro = form.dataset.cadastro === 'true';
  const mensagem = form.querySelector('#mensagem-auth');
  mensagem.hidden = false;
  if (cadastro && dados.senha !== dados.confirmarSenha) {
    mensagem.textContent = 'As senhas precisam ser iguais.';
    return;
  }

  const botao = form.querySelector('[type="submit"]');
  estado.autenticando = true;
  botao.disabled = true;
  mensagem.textContent = cadastro ? 'Criando sua conta…' : 'Conferindo seus dados…';
  try {
    const resultado = await requisicaoConta(cadastro ? '/cadastro' : '/login', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
    estado.usuario = resultado.usuario;
    estado.pedidos = null;
    estado.cliente.nome ||= resultado.usuario.nome;
    estado.cliente.telefone ||= aplicarMascara('telefone', resultado.usuario.telefone);
    form.reset();
    if (['Login', 'Cadastro', 'Perfil', 'Pedidos'].includes(estado.pagina)) navegar('Perfil');
    else atualizarCabecalho();
    notificar(cadastro ? 'Conta criada. Boas-vindas!' : 'Você entrou na sua conta.');
  } catch (erro) {
    mensagem.textContent = erro.status ? erro.message : 'Não foi possível conectar. Tente novamente.';
  } finally {
    estado.autenticando = false;
    botao.disabled = false;
  }
}

async function sairDaConta(botao) {
  if (botao.disabled) return;
  botao.disabled = true;
  try {
    await requisicaoConta('/sair', { method: 'POST', body: '{}' });
    limparConta();
    navegar('Início');
    notificar('Você saiu da sua conta.');
  } catch {
    notificar('Não foi possível sair. Tente novamente.');
  } finally {
    botao.disabled = false;
  }
}

function paginaPerfil() {
  if (!estado.usuario) return paginaAcesso();
  const usuario = estado.usuario;
  return `${tituloPagina('SUA CONTA', 'Meu perfil', 'Seus dados para os próximos bons momentos.')}
    <div class="account-layout">
      <aside class="panel account-summary">
        <span class="account-initial">${escapar(usuario.nome.slice(0, 1))}</span>
        <h2>${escapar(usuario.nome)}</h2>
        <p>${escapar(usuario.email)}</p>
        <button class="text-button" data-page="Pedidos">Ver meus pedidos ${icone('arrow', 16)}</button>
        <button class="login-button" data-acao="sair">Sair da conta</button>
      </aside>
      <form class="panel profile-form" id="form-perfil">
        <h2>Seus dados</h2>
        <p>Você pode atualizar seu nome e telefone.</p>
        <div class="form-grid">
          <label class="wide">Nome completo<input name="nome" required minlength="2" maxlength="120" autocomplete="name" value="${escapar(usuario.nome)}" /></label>
          <label>CPF<input readonly value="${escapar(aplicarMascara('cpf', usuario.cpf))}" /></label>
          <label>Telefone<input name="telefone" required type="tel" autocomplete="tel" inputmode="numeric" data-mascara="telefone" maxlength="15" value="${escapar(aplicarMascara('telefone', usuario.telefone))}" /></label>
          <label class="wide">E-mail<input type="email" readonly value="${escapar(usuario.email)}" /></label>
        </div>
        <button type="submit" class="primary profile-save">Salvar alterações ${icone('check', 17)}</button>
        <p class="demo-note" id="mensagem-perfil" role="status" hidden></p>
      </form>
    </div>`;
}

async function salvarPerfil(form) {
  const botao = form.querySelector('[type="submit"]');
  if (botao.disabled) return;
  botao.disabled = true;
  const mensagem = form.querySelector('#mensagem-perfil');
  try {
    const dados = Object.fromEntries(new FormData(form));
    const resultado = await requisicaoConta('/perfil', { method: 'PUT', body: JSON.stringify(dados) });
    estado.usuario = resultado.usuario;
    estado.cliente.nome = resultado.usuario.nome;
    estado.cliente.telefone = aplicarMascara('telefone', resultado.usuario.telefone);
    atualizarCabecalho();
    if (estado.pagina === 'Perfil') {
      render();
      notificar('Seus dados foram atualizados.');
    }
  } catch (erro) {
    if (erro.status === 401) {
      limparConta();
      render();
      notificar('Sua sessão expirou. Entre novamente.');
    } else {
      mensagem.hidden = false;
      mensagem.textContent = erro.status ? erro.message : 'Não foi possível salvar. Tente novamente.';
    }
  } finally {
    botao.disabled = false;
  }
}

function paginaPedidos() {
  if (!estado.usuario) return paginaAcesso();
  const cabecalho = `${tituloPagina('SEUS BONS MOMENTOS', 'Meus pedidos', 'Consulte os pedidos feitos enquanto você estava conectado.')}
    <div class="orders-toolbar"><span>Pedidos de ${escapar(estado.usuario.nome.split(/\s+/)[0])}</span>
    <button class="login-button" data-acao="atualizar-pedidos">${icone('refresh', 16)} Atualizar</button></div>`;

  if (estado.erroPedidos) {
    return cabecalho + `<section class="panel empty" role="alert"><p>${escapar(estado.erroPedidos)}</p>
      <button class="primary" data-acao="atualizar-pedidos">Tentar novamente</button></section>`;
  }
  if (estado.pedidos === null)
    return cabecalho + '<section class="panel empty" role="status">Carregando seus pedidos…</section>';
  if (!estado.pedidos.length) {
    return cabecalho + `<section class="panel empty account-empty">${icone('bag', 38)}
      <h3>Seu próximo pedido começa aqui.</h3><p>Escolha uma pizza no cardápio para fazer seu primeiro pedido com esta conta.</p>
      <button class="primary" data-page="Cardápio">Ver cardápio ${icone('arrow', 17)}</button></section>`;
  }

  const pedidos = estado.pedidos.map((pedido) => {
    const data = new Date(pedido.dataPedido);
    const quando = Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
    return `<article class="panel order-card">
      <div class="order-heading"><div><span class="eyebrow">PEDIDO #${pedido.id}</span><h2>${escapar(quando)}</h2></div>
        <span class="order-status">${escapar(pedido.status)}</span></div>
      <p>${escapar(pedido.clienteEndereco)}</p>
      <div class="order-total"><span>${escapar(pedido.formaPagamento)}</span><strong>${formatarMoeda(pedido.valorTotal)}</strong></div>
    </article>`;
  }).join('');
  return cabecalho + `<section class="orders-list" aria-label="Seus pedidos">${pedidos}</section>`;
}

async function carregarPedidos() {
  if (!estado.usuario) return;
  const usuarioId = estado.usuario.id;
  const versao = ++versaoPedidos;
  estado.pedidos = null;
  estado.erroPedidos = '';
  if (estado.pagina === 'Pedidos') render();
  try {
    const pedidos = await requisicaoConta('/meus-pedidos');
    if (estado.usuario?.id === usuarioId && versao === versaoPedidos) estado.pedidos = pedidos;
  } catch (erro) {
    if (estado.usuario?.id !== usuarioId || versao !== versaoPedidos) return;
    if (erro.status === 401) limparConta();
    else estado.erroPedidos = 'Não foi possível carregar seus pedidos. Tente novamente.';
  } finally {
    if (estado.pagina === 'Pedidos' && versao === versaoPedidos) render();
  }
}
