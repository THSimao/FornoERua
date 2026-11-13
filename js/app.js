
const estado = {
  pagina: 'Início',
  categoria: 'Todos',
  busca: '',
  carrinho: {},
  cep: '',
  frete: null,
  checkout: false,
  cliente: {},
  erroPedido: '',
  enviando: false,
  claro: false,
  usuario: null,
  carregandoSessao: true,
  autenticando: false,
  pedidos: null,
  erroPedidos: '',
};

const principal = document.getElementById('conteudo');
let temporizadorAviso;
let freteDaLoja = null;
let ultimaTentativa;
let versaoPedidos = 0;
const escapar = (texto) => String(texto ?? '').replace(/[&<>"']/g, (letra) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[letra]);

const totalItens = () => Object.values(estado.carrinho).reduce((a, b) => a + b, 0);
const subtotal = () => PRODUTOS.reduce((soma, p) => soma + p.preco * (estado.carrinho[p.id] || 0), 0);
const produtosFiltrados = () =>
  PRODUTOS.filter(
    (p) =>
      (estado.categoria === 'Todos' || p.categoria === estado.categoria) &&
      `${p.nome} ${p.descricao ?? ''}`.toLowerCase().includes(estado.busca.toLowerCase())
  );
const rotulo = (pagina) => (pagina === 'Pedidos' ? 'Meus pedidos' : pagina === 'Perfil' ? 'Meu perfil' : pagina);
const paginaDoHash = () => PAGINAS.find((p) => `#${p}` === decodeURI(location.hash)) || 'Início';

function navegar(pagina) {
  if (estado.usuario && ['Login', 'Cadastro'].includes(pagina)) pagina = 'Perfil';
  alternarMenu(false);
  estado.pagina = pagina;
  estado.checkout = false;
  if (decodeURI(location.hash) !== `#${pagina}`) location.hash = pagina;
  render();
  if (pagina === 'Pedidos' && estado.usuario) carregarPedidos();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('hashchange', () => {
  const pagina = paginaDoHash();
  if (pagina !== estado.pagina) navegar(pagina);
});

function notificar(texto) {
  const raiz = document.getElementById('aviso-raiz');
  raiz.innerHTML = `<div role="status" class="toast"><span class="toast-icon">${icone('check', 18)}</span>${texto}<button data-acao="fechar-aviso" aria-label="Fechar aviso">${icone('close', 17)}</button></div>`;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (raiz.innerHTML = ''), 3500);
}

function atualizarCabecalho() {
  document.querySelectorAll('header [data-conta="acesso"]').forEach((botao) => {
    botao.dataset.page = estado.usuario ? 'Perfil' : 'Login';
    botao.textContent = estado.usuario ? estado.usuario.nome.split(/\s+/)[0] : 'Login';
    botao.setAttribute('aria-label', estado.usuario ? 'Abrir meu perfil' : 'Fazer login');
  });
  document.querySelectorAll('header [data-conta="secundario"]').forEach((botao) => {
    botao.textContent = estado.usuario ? 'Sair' : 'Criar conta';
    botao.classList.toggle('session-out', !!estado.usuario);
    if (estado.usuario) {
      delete botao.dataset.page;
      botao.dataset.acao = 'sair';
    } else {
      delete botao.dataset.acao;
      botao.dataset.page = 'Cadastro';
    }
  });
  document.getElementById('contador-carrinho').textContent = totalItens();
  document.getElementById('botao-carrinho').classList.toggle('selected', estado.pagina === 'Carrinho');
  document.querySelectorAll('#menu-principal button').forEach((b) => {
    const ativo = b.dataset.page === estado.pagina;
    b.classList.toggle('active', ativo);
    if (ativo) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.getElementById('app').classList.toggle('light', estado.claro);
  const botaoTema = document.getElementById('botao-tema');
  botaoTema.innerHTML = icone(estado.claro ? 'moon' : 'sun', 20);
  botaoTema.setAttribute('aria-label', estado.claro ? 'Ativar modo escuro' : 'Ativar modo claro');
  botaoTema.setAttribute('aria-pressed', String(estado.claro));
}

function alternarMenu(aberto) {
  document.querySelector('header').classList.toggle('menu-aberto', aberto);
  const botao = document.getElementById('botao-menu');
  botao.setAttribute('aria-expanded', String(aberto));
  botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  botao.innerHTML = icone(aberto ? 'close' : 'menu', 22);
}

document.getElementById('botao-menu').addEventListener('click', () => {
  alternarMenu(document.getElementById('botao-menu').getAttribute('aria-expanded') !== 'true');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.querySelector('header').classList.contains('menu-aberto')) {
    alternarMenu(false);
    document.getElementById('botao-menu').focus();
  }
});

function cartaoProduto(p, simples = false) {
  const qtd = estado.carrinho[p.id] || 0;
  const imagem = p.imagem
    ? `<img src="${p.imagem}" alt="${escapar(p.nome)}" loading="lazy" />`
    : p.id === 7 ? '<div class="water-art">água<span>mineral · 500 ml</span></div>'
      : `<div class="product-placeholder">${icone('flame', 48)}</div>`;
  const selo = p.selo
    ? `<span class="product-tag ${!simples && p.selo === 'Mais pedida' ? 'popular' : ''}">${!simples && p.selo === 'Mais pedida' ? icone('flame', 13) : ''} ${p.selo}</span>`
    : '';
  const vegetariana = !simples && p.vegetariana ? `<span class="veggie" title="Vegetariana">${icone('leaf', 16)}</span>` : '';
  const bebida = p.categoria === 'Bebidas';
  const meta = simples
    ? '8 FATIAS · 35 CM'
    : `${bebida ? 'PARA ACOMPANHAR' : '8 FATIAS · 35 CM'}<span>${p.categoria === 'Pizzas especiais' ? 'ESPECIAL' : 'CLÁSSICA'}</span>`;
  return `<article class="product-card">
    <div class="product-image">${imagem}${selo}${vegetariana}</div>
    <div class="product-body">
      <div class="product-meta">${meta}</div>
      <h3>${escapar(p.nome)}</h3>
      <p>${escapar(p.descricao)}</p>
      <div class="product-purchase">
        <div class="price-row"><strong>${formatarMoeda(p.preco)}</strong><span>${bebida ? '500 ml' : 'pizza inteira'}</span></div>
        <button class="add-button" data-acao="adicionar" data-id="${p.id}" aria-label="Adicionar ${escapar(p.nome)} ao carrinho">${icone('plus', 17)} Adicionar <b ${qtd ? '' : 'hidden'}>${qtd}</b></button>
      </div>
    </div>
  </article>`;
}

function tituloPagina(eyebrow, titulo, descricao) {
  return `<div class="page-title"><div class="eyebrow">${eyebrow}</div><h1>${titulo}<span>.</span></h1><p>${descricao}</p></div>`;
}

function migalhas() {
  if (estado.pagina === 'Início') return '';
  return `<div class="breadcrumb"><button data-page="Início">Início</button> <span>/</span> <strong>${rotulo(estado.pagina)}</strong></div>`;
}

function paginaInicio() {
  const valores = [
    ['clock', 'O tempo é nosso ingrediente'],
    ['leaf', 'Ingredientes de verdade'],
    ['flame', 'O sabor do forno a lenha'],
    ['bag', 'Carinho em cada entrega'],
  ].map(([i, t]) => `<span>${icone(i, 18)}${t}</span>`).join('');

  const passos = [
    ['01', 'search', 'Encontre sua favorita', 'Explore os clássicos e os sabores especiais. Tem uma pizza para cada vontade.'],
    ['02', 'bag', 'Monte seu pedido', 'Adicione ao carrinho, informe seu CEP e confira tudo antes de finalizar.'],
    ['03', 'box', 'Prepare a mesa', 'Receba a confirmação do pedido e aguarde sua pizza. A próxima fatia é sua.'],
  ].map(([n, i, t, x]) => `<article class="panel"><div class="how-top">${icone(i, 26)}<span>${n}</span></div><h3>${t}</h3><p>${x}</p></article>`).join('');

  const destaques = [1, 3, 4].map((id) => PRODUTOS.find((p) => p.id === id))
    .filter(Boolean).map((p) => cartaoProduto(p, true)).join('');

  return `<div class="home">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero-copy">
        <div class="eyebrow"><span></span> PIZZA ARTESANAL. ALMA DE BAIRRO.</div>
        <h1 id="home-title">Pizza artesanal.<br/>Bons encontros.<br/><span>À sua mesa.</span></h1>
        <p>48 horas de fermentação, ingredientes escolhidos com cuidado e o sabor do forno a lenha. Nossa receita para reunir quem você gosta.</p>
        <div class="home-actions">
          <button class="primary" data-page="Cardápio">Escolher minha pizza ${icone('arrow', 18)}</button>
          <button class="home-story-link" data-acao="ir-historia">Nossa história <span>↗</span></button>
        </div>
        <div class="home-proof">
          <div><strong>48h</strong><span>de fermentação lenta</span></div>
          <div><strong>35 cm</strong><span>para compartilhar</span></div>
          <div><strong>35–50 min</strong><span>até a sua porta*</span></div>
        </div>
      </div>
      <div class="home-hero-image">
        <img src="${FOTOS.heroInicio}" alt="Pizza artesanal sobre uma mesa de madeira, pronta para compartilhar" />
        <div class="home-image-note">${icone('flame', 22)}<div><strong>Do forno, com carinho.</strong><span>Feita à mão. Pensada para compartilhar.</span></div></div>
      </div>
    </section>

    <div class="home-values">${valores}</div>

    <section class="home-favorites" aria-labelledby="favorites-title">
      <div class="section-top">
        <div><div class="eyebrow">DA NOSSA CASA PARA A SUA</div><h2 id="favorites-title">Comece pelas favoritas<span>.</span></h2></div>
        <button class="home-story-link" data-page="Cardápio">Ver cardápio completo ${icone('arrow', 17)}</button>
      </div>
      <div class="product-grid">${destaques}</div>
    </section>

    <section id="nossa-historia" class="home-story" aria-labelledby="story-title">
      <div class="story-image"><img src="${FOTOS.historia}" alt="Pizza assando dentro de um forno a lenha" loading="lazy" /><span>O fogo transforma. O cuidado aproxima.</span></div>
      <div class="story-copy">
        <div class="eyebrow">NOSSA ESSÊNCIA, NOSSA HISTÓRIA</div>
        <h2 id="story-title">Tem forno.<br/>Tem rua.<br/><span>Tem encontro.</span></h2>
        <p>A Forno &amp; Rua parte de uma ideia simples: pizza boa é aquela que aproxima pessoas. A que chega no meio de uma conversa, acompanha um filme ou transforma uma noite comum em um encontro especial.</p>
        <p>O forno representa o cuidado: a massa que descansa, o molho preparado com atenção e o calor que dá vida a cada receita. A rua é o caminho até você — a conexão entre a nossa cozinha e a sua mesa.</p>
        <p>É essa a história que queremos construir, uma entrega de cada vez. Sem complicar o que é bom. Com tempo, ingredientes de verdade e espaço para mais uma fatia.</p>
        <div class="story-signature">${icone('flame', 25)}<span>Da nossa cozinha para os seus bons momentos.</span></div>
      </div>
    </section>

    <section class="home-how" aria-labelledby="how-title">
      <div class="eyebrow">SIMPLES ASSIM</div>
      <h2 id="how-title">Seu momento gostoso começa aqui<span>.</span></h2>
      <p>Da escolha à primeira fatia, a gente cuida de tudo.</p>
      <div class="how-grid">${passos}</div>
    </section>

    <section class="home-faq" aria-labelledby="faq-title">
      <div><div class="eyebrow">ANTES DA PRIMEIRA FATIA</div><h2 id="faq-title">A gente te conta<span>.</span></h2><p>Respostas rápidas para pedir sem dúvidas.</p></div>
      <div class="faq-list">
        <details><summary>Qual é o horário de atendimento?</summary><p>Atendemos todos os dias, das 18h às 23h. Escolha sua favorita no cardápio e prepare a mesa.</p></details>
        <details><summary>Como consultar a taxa de entrega?</summary><p>Adicione seus produtos ao carrinho e informe seu CEP para consultar a estimativa. Nesta versão demonstrativa, o cálculo do frete é simulado.</p></details>
        <details><summary>Qual é o tamanho das pizzas?</summary><p>Nossas pizzas têm 35 cm e são cortadas em 8 fatias. Consulte os ingredientes de cada sabor no cardápio.</p></details>
        <details><summary>Há opções vegetarianas?</summary><p>Sim! Procure o símbolo de folha no cardápio. Para restrições alimentares e informações sobre alérgenos, entre em contato antes de pedir.</p></details>
      </div>
    </section>

    <section class="home-callout">
      <div><div class="eyebrow">DEU FOME POR AÍ?</div><h2>Sua próxima pizza favorita<br/>está a um clique.</h2><p>A gente acende o forno. Você reúne as boas companhias.</p></div>
      <button data-page="Cardápio">Escolher minha pizza ${icone('arrow', 19)}</button>
    </section>
    <p class="home-footnote">* Tempo de entrega estimado, sujeito à localização e à demanda.</p>
  </div>`;
}

function paginaCardapio() {
  const filtros = CATEGORIAS.map(
    (c, i) => `<button class="${estado.categoria === c ? 'chosen' : ''}" data-acao="categoria" data-categoria="${escapar(c)}">${i === 0 ? icone('box', 16) : ''} ${escapar(c)}</button>`
  ).join('');
  return `
    <section class="menu-hero">
      <div class="hero-copy">
        <div class="eyebrow"><span></span> DO NOSSO FORNO PARA A SUA MESA</div>
        <h1>O seu próximo<br/>bom momento<span>.</span></h1>
        <p>Massa de fermentação lenta, ingredientes de verdade.<br class="desktop"/> Escolha sua favorita. O resto é com a gente.</p>
        <div class="hero-details"><span>${icone('clock', 16)} 35–50 min</span><i></i><span>${icone('flame', 16)} Feita no forno a lenha</span></div>
      </div>
      <div class="hero-photo"><img src="${FOTOS.heroCardapio}" alt="Pizza artesanal recém-saída do forno" /><span class="photo-label">${icone('leaf', 17)} Artesanal em cada detalhe</span></div>
      <div class="open-badge">${icone('clock', 14)} Todos os dias · 18h às 23h</div>
    </section>

    <section class="menu-section">
      <div class="section-top">
        <div><div class="eyebrow">ESCOLHA. PEÇA. APROVEITE.</div><h2>Nosso cardápio<span>.</span></h2></div>
        <label class="search">${icone('search')}<input id="busca" value="${escapar(estado.busca)}" placeholder="Qual é a sua vontade de hoje?" aria-label="Buscar produtos" autocomplete="off" /><button id="limpar-busca" data-acao="limpar-busca" aria-label="Limpar busca" ${estado.busca ? '' : 'hidden'}>${icone('close', 16)}</button></label>
      </div>
      <div class="filter-line"><div class="filters" id="filtros">${filtros}</div><span class="product-count" id="contagem"></span></div>
      <div id="lista-produtos"></div>
    </section>

    <div class="quality-strip">${icone('leaf', 25)}<div><strong>O segredo está no tempo e no cuidado.</strong><p>Nossa massa descansa por 48 horas. Sua única tarefa é aproveitar.</p></div><span>FEITO À MÃO. FEITO PRA VOCÊ.</span></div>`;
}

function atualizarLista() {
  const lista = document.getElementById('lista-produtos');
  if (!lista) return;
  const itens = produtosFiltrados();
  lista.innerHTML =
    `<div class="product-grid">${itens.map((p) => cartaoProduto(p)).join('')}</div>` +
    (itens.length
      ? ''
      : `<div class="empty">${icone('search', 32)}<h3>Nenhuma delícia por aqui.</h3><p>Tente outro nome ou escolha uma nova categoria.</p><button class="primary" data-acao="resetar-cardapio">Ver todo o cardápio</button></div>`);
  document.getElementById('contagem').textContent = `${itens.length} opções para você`;
  document.getElementById('limpar-busca').hidden = !estado.busca;
  document.querySelectorAll('#filtros button').forEach((b) => b.classList.toggle('chosen', b.dataset.categoria === estado.categoria));
}

function paginaCarrinho() {
  const total = totalItens();
  const linhas = PRODUTOS.filter((p) => estado.carrinho[p.id] > 0)
    .map(
      (p) => `<div class="cart-item${p.imagem ? '' : ' no-image'}">
        ${p.imagem ? `<img src="${p.imagem}" alt="${escapar(p.nome)}" />` : ''}
        <div class="cart-item-info">
          <h3>${escapar(p.nome)}</h3><p>${formatarMoeda(p.preco)} / unidade</p>
          <div class="quantity">
            <button data-acao="quantidade" data-id="${p.id}" data-delta="-1" aria-label="Diminuir ${escapar(p.nome)}">${icone('minus', 14)}</button>
            <span>${estado.carrinho[p.id]}</span>
            <button data-acao="quantidade" data-id="${p.id}" data-delta="1" aria-label="Aumentar ${escapar(p.nome)}">${icone('plus', 14)}</button>
          </div>
        </div>
        <strong>${formatarMoeda(p.preco * estado.carrinho[p.id])}</strong>
        <button class="icon-button" data-acao="remover" data-id="${p.id}" aria-label="Remover ${escapar(p.nome)}">${icone('close', 18)}</button>
      </div>`
    )
    .join('');

  const conteudo =
    total === 0
      ? `<div class="empty">${icone('bag', 40)}<h3>Uma boa pizza começa por aqui.</h3><p>Seu carrinho está vazio. Encontre seu sabor favorito no cardápio.</p><button class="primary" data-page="Cardápio">Ver cardápio ${icone('arrow', 18)}</button></div>`
      : `<h3>Seu pedido <span class="muted">(${total} ${total === 1 ? 'item' : 'itens'})</span></h3>${linhas}<button class="text-button" data-page="Cardápio">+ Adicionar mais delícias</button>`;

  return `${tituloPagina('SEU PEDIDO', estado.checkout ? 'Quase à sua mesa' : 'Seu carrinho', 'Revise suas escolhas e informe os dados para a entrega.')}
    <div class="two-columns">
      <section class="panel">${conteudo}</section>
      <aside class="panel summary">
        <h3>Resumo do pedido</h3>
        <label for="cep">CEP de entrega</label>
        <form class="cep-form" id="form-cep"><input id="cep" placeholder="Seu CEP" inputmode="numeric" maxlength="9" value="${estado.cep}" ${estado.enviando ? 'disabled' : ''} /><button type="submit" ${estado.enviando ? 'disabled' : ''}>Calcular</button></form>
        <small id="cep-info"></small>
        <div class="summary-lines">
          <p>Subtotal <span id="valor-subtotal"></span></p>
          <p>Taxa de entrega <span id="valor-frete"></span></p>
          <p class="total">Total <strong id="valor-total"></strong></p>
        </div>
        ${estado.checkout && total ? formularioPedido() : '<button class="primary full" id="botao-checkout" data-acao="checkout"></button>'}
        <p class="secure">Pagamento na entrega.</p>
        <p class="demo-note" role="status" ${estado.erroPedido ? '' : 'hidden'}>${escapar(estado.erroPedido)}</p>
      </aside>
    </div>`;
}

function formularioPedido() {
  const cliente = estado.cliente;
  const pagamentos = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro'];
  return `<form id="form-pedido">
    <fieldset class="form-grid" ${estado.enviando ? 'disabled' : ''}>
      <label>Nome<input name="nome" autocomplete="name" required maxlength="120" value="${escapar(cliente.nome)}" /></label>
      <label>Telefone<input name="telefone" type="tel" autocomplete="tel" inputmode="numeric" data-mascara="telefone" required minlength="14" maxlength="15" value="${escapar(cliente.telefone)}" /></label>
      <label class="wide">Endereço e número<input name="endereco" autocomplete="street-address" required maxlength="230" value="${escapar(cliente.endereco)}" /></label>
      <label class="wide">Pagamento<select name="pagamento">${pagamentos.map((p) => `<option ${cliente.pagamento === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <label class="wide">Observações<input name="observacoes" maxlength="500" value="${escapar(cliente.observacoes)}" /></label>
    </fieldset>
    <button class="primary full" id="botao-checkout" type="submit"></button>
  </form>`;
}

function atualizarResumo() {
  const info = document.getElementById('cep-info');
  if (!info) return;
  info.textContent = freteDaLoja === null ? 'Servidor de pedidos indisponível. Recarregue a página para tentar novamente.'
    : estado.frete !== null ? 'Entrega estimada: 35–50 min · frete simulado' : 'Calcule a taxa de entrega pelo CEP.';
  document.getElementById('valor-subtotal').textContent = formatarMoeda(subtotal());
  document.getElementById('valor-frete').textContent = estado.frete === null ? 'A calcular' : formatarMoeda(estado.frete);
  document.getElementById('valor-total').textContent = formatarMoeda(subtotal() + (estado.frete || 0));
  const botao = document.getElementById('botao-checkout');
  botao.disabled = estado.enviando || !totalItens() || estado.frete === null;
  const texto = estado.enviando ? 'Enviando pedido…' : estado.checkout && totalItens() ? 'Finalizar pedido' : 'Avançar para checkout';
  botao.innerHTML = `${texto}${icone('arrow', 18)}`;
}

function paginaAcesso() {
  if (estado.carregandoSessao) {
    return '<section class="panel empty" role="status">Conferindo seu acesso…</section>';
  }
  const alvo = estado.pagina === 'Pedidos' ? 'seus pedidos' : 'seu perfil';
  return `<section class="panel guest-gate">${icone('user', 36)}
    <h1>${estado.pagina === 'Pedidos' ? 'Seus bons momentos' : 'Um espaço para você'}<span>.</span></h1>
    <p>Entre na sua conta para acessar ${alvo}. Ainda não tem uma? Cadastre-se para começar.</p>
    <div><button class="primary" data-page="Login">Fazer login ${icone('arrow', 17)}</button><button class="login-button" data-page="Cadastro">Criar uma conta</button></div>
  </section>`;
}

function campo(rotuloCampo, nome, placeholder, mascara, largo) {
  const max = mascara === 'cpf' ? 14 : mascara === 'telefone' ? 15 : 120;
  const padrao = mascara === 'cpf' ? 'pattern="\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"' : '';
  return `<label class="${largo ? 'wide' : ''}">${rotuloCampo}<input name="${nome}" type="text" placeholder="${placeholder}" required maxlength="${max}" ${mascara ? `data-mascara="${mascara}" inputmode="numeric"` : ''} ${padrao} /></label>`;
}

function paginaAuth() {
  if (estado.carregandoSessao) return paginaAcesso();
  const cadastro = estado.pagina === 'Cadastro';
  return `<section class="auth-layout">
    <div class="auth-intro">
      <div class="eyebrow">${cadastro ? 'FAÇA PARTE DA NOSSA MESA' : 'BEM-VINDO À FORNO &amp; RUA'}</div>
      <h1>${cadastro ? 'Sua próxima pizza começa por aqui' : 'Bom ter você por aqui'}<span>.</span></h1>
      <p>${cadastro ? 'Crie seu espaço para viver bons momentos, uma fatia de cada vez.' : 'Entre na sua conta para acompanhar seus pedidos e cuidar dos seus dados.'}</p>
      <div class="auth-photo"><img src="${FOTOS.historia}" alt="O cuidado do preparo artesanal" loading="lazy" /></div>
      <div class="quality-strip">${icone('flame', 26)}<div><strong>Pizza boa aproxima pessoas.</strong><p>O próximo bom momento pode ser o seu.</p></div></div>
    </div>
    <form class="panel profile-form auth-form" id="form-auth" data-cadastro="${cadastro}">
      <h2>${cadastro ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
      <p>Preencha os campos abaixo para continuar.</p>
      <div class="form-grid">
        ${cadastro ? campo('Nome completo', 'nome', 'Seu nome completo', '', true) + campo('CPF', 'cpf', '000.000.000-00', 'cpf') + campo('Telefone', 'telefone', '(11) 99999-9999', 'telefone') : ''}
        <label class="wide">E-mail<input type="email" name="email" autocomplete="email" placeholder="voce@exemplo.com" required maxlength="120" /></label>
        <label class="wide">Senha<input type="password" name="senha" autocomplete="${cadastro ? 'new-password' : 'current-password'}" placeholder="${cadastro ? 'Crie uma senha com pelo menos 8 caracteres' : 'Digite sua senha'}" minlength="${cadastro ? 8 : 1}" maxlength="100" required /></label>
        ${cadastro ? '<label class="wide">Confirme a senha<input type="password" name="confirmarSenha" autocomplete="new-password" placeholder="Digite sua senha novamente" minlength="8" maxlength="100" required /></label>' : ''}
      </div>
      <button class="primary full auth-submit" type="submit" ${estado.autenticando ? 'disabled' : ''}>${estado.autenticando ? 'Aguarde…' : cadastro ? 'Criar conta' : 'Entrar'}${icone('arrow', 17)}</button>
      <p role="status" class="demo-note auth-message" id="mensagem-auth" hidden></p>
      <div class="auth-switch">${cadastro ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <button type="button" data-page="${cadastro ? 'Login' : 'Cadastro'}">${cadastro ? 'Fazer login' : 'Cadastre-se'}</button></div>
      <p class="auth-disclaimer">Seus dados são usados para identificar sua conta e seus pedidos.</p>
    </form>
  </section>`;
}

function render() {
  const foco = document.activeElement;
  const idFoco = foco && foco.id && ['busca', 'cep'].includes(foco.id) ? foco.id : null;

  const paginas = {
    Início: paginaInicio,
    Cardápio: paginaCardapio,
    Carrinho: paginaCarrinho,
    Pedidos: paginaPedidos,
    Perfil: paginaPerfil,
    Login: paginaAuth,
    Cadastro: paginaAuth,
  };
  principal.innerHTML = migalhas() + paginas[estado.pagina]();
  atualizarCabecalho();
  atualizarLista();
  atualizarResumo();

  if (idFoco) document.getElementById(idFoco)?.focus();
}

function alterarQuantidade(id, delta) {
  estado.carrinho[id] = Math.min(50, Math.max(0, (estado.carrinho[id] || 0) + delta));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('header')) alternarMenu(false);
  const pagina = e.target.closest('[data-page]');
  if (pagina) {
    e.preventDefault();
    navegar(pagina.dataset.page);
    return;
  }
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const { acao, id, delta, categoria } = el.dataset;
  if (estado.enviando && ['adicionar', 'quantidade', 'remover', 'checkout'].includes(acao)) return;

  switch (acao) {
    case 'adicionar': {
      const produto = PRODUTOS.find((p) => p.id === Number(id));
      alterarQuantidade(produto.id, 1);
      document.querySelectorAll(`.add-button[data-id="${produto.id}"] b`).forEach((b) => {
        b.textContent = estado.carrinho[produto.id];
        b.hidden = false;
      });
      document.getElementById('contador-carrinho').textContent = totalItens();
      notificar(`${escapar(produto.nome)} adicionada ao carrinho`);
      break;
    }
    case 'quantidade':
      alterarQuantidade(Number(id), Number(delta));
      render();
      break;
    case 'remover':
      estado.carrinho[Number(id)] = 0;
      render();
      break;
    case 'categoria':
      estado.categoria = categoria;
      atualizarLista();
      break;
    case 'limpar-busca':
      estado.busca = '';
      document.getElementById('busca').value = '';
      document.getElementById('busca').focus();
      atualizarLista();
      break;
    case 'resetar-cardapio':
      estado.busca = '';
      estado.categoria = 'Todos';
      document.getElementById('busca').value = '';
      atualizarLista();
      break;
    case 'checkout':
      estado.checkout = true;
      estado.erroPedido = '';
      render();
      document.querySelector('#form-pedido input')?.focus();
      break;
    case 'ir-historia':
      document.getElementById('nossa-historia')?.scrollIntoView({ behavior: 'smooth' });
      break;
    case 'abrir-chat':
      if (document.getElementById('support-chat').hidden) document.getElementById('chat-abrir').click();
      break;
    case 'sair':
      sairDaConta(el);
      break;
    case 'atualizar-pedidos':
      carregarPedidos();
      break;
    case 'fechar-aviso':
      document.getElementById('aviso-raiz').innerHTML = '';
      break;
  }
});

document.getElementById('botao-tema').addEventListener('click', () => {
  estado.claro = !estado.claro;
  atualizarCabecalho();
  try { localStorage.setItem('forno-tema', estado.claro ? 'claro' : 'escuro'); } catch { }
});

document.getElementById('pular').addEventListener('click', (e) => {
  e.preventDefault();
  principal.focus();
});

function aplicarMascara(tipo, valor) {
  let n = valor.replace(/\D/g, '');
  if (tipo === 'cpf') n = n.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1-$2');
  if (tipo === 'telefone') n = n.slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');
  return n;
}

document.addEventListener('input', (e) => {
  const alvo = e.target;
  if (alvo.id === 'busca') {
    estado.busca = alvo.value;
    atualizarLista();
  } else if (alvo.id === 'cep') {
    alvo.value = alvo.value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
    estado.cep = alvo.value;
    estado.frete = null;
    atualizarResumo();
  } else if (alvo.dataset.mascara) {
    alvo.value = aplicarMascara(alvo.dataset.mascara, alvo.value);
  }
  if (alvo.form?.id === 'form-pedido') estado.cliente[alvo.name] = alvo.value;
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'form-cep') {
    e.preventDefault();
    if (estado.cep.replace(/\D/g, '').length === 8) {
      estado.frete = freteDaLoja;
      atualizarResumo();
    } else {
      notificar('Informe um CEP com 8 números.');
    }
  }

  if (e.target.id === 'form-pedido') {
    e.preventDefault();
    if (estado.enviando || estado.frete === null || !totalItens()) return;
    const cliente = Object.fromEntries(new FormData(e.target));
    const itens = PRODUTOS.filter((p) => estado.carrinho[p.id] > 0)
      .map((p) => ({ produtoId: p.id, quantidade: estado.carrinho[p.id] }));
    finalizarCompra(cliente, itens);
  }

  if (e.target.id === 'form-auth') {
    e.preventDefault();
    autenticar(e.target);
  }
  if (e.target.id === 'form-perfil') {
    e.preventDefault();
    salvarPerfil(e.target);
  }
});

hidratarIcones();
try { estado.claro = localStorage.getItem('forno-tema') === 'claro'; } catch { }
estado.pagina = paginaDoHash();
render();

async function carregarCardapio() {
  try {
    const resposta = await fetch(API + '/produtos', { signal: AbortSignal.timeout(6000) });
    if (!resposta.ok) throw new Error('Cardápio indisponível.');
    const dados = await resposta.json();
    PRODUTOS = dados.produtos.map((produto) => ({
      ...CARDAPIO_DEMO.find((p) => p.id === produto.id),
      ...produto,
    }));
    CATEGORIAS = ['Todos', ...new Set(PRODUTOS.map((p) => p.categoria))];
    freteDaLoja = dados.frete;
    for (const id of Object.keys(estado.carrinho)) {
      if (!PRODUTOS.some((p) => p.id === Number(id))) delete estado.carrinho[id];
    }
    if (!CATEGORIAS.includes(estado.categoria)) estado.categoria = 'Todos';
    if (['Início', 'Cardápio', 'Carrinho'].includes(estado.pagina) && !estado.enviando) render();
  } catch (erro) {
    console.error('Erro ao carregar o cardápio:', erro);
  }
}

async function finalizarCompra(dadosCliente, itensCarrinho) {
  const corpo = JSON.stringify({
    clienteNome: dadosCliente.nome.trim(),
    clienteTelefone: dadosCliente.telefone,
    clienteEndereco: dadosCliente.endereco.trim(),
    cep: estado.cep,
    formaPagamento: dadosCliente.pagamento,
    observacoes: dadosCliente.observacoes.trim(),
    itens: itensCarrinho,
  });
  if (ultimaTentativa?.corpo !== corpo) {
    ultimaTentativa = { corpo, chave: crypto.randomUUID() };
  }

  estado.enviando = true;
  estado.erroPedido = '';
  render();
  try {
    const resposta = await fetch(API + '/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': ultimaTentativa.chave },
      body: corpo,
      signal: AbortSignal.timeout(12000),
    });
    const resultado = await resposta.json();
    if (resposta.status === 401) {
      limparConta();
      atualizarCabecalho();
    }
    if (!resposta.ok || !Number.isInteger(resultado.id)) {
      estado.erroPedido = resultado.erro || 'Não foi possível enviar o pedido.';
      return;
    }
    estado.carrinho = {};
    estado.pedidos = null;
    estado.cliente = {};
    estado.checkout = false;
    estado.cep = '';
    estado.frete = null;
    ultimaTentativa = undefined;
    notificar('Pedido #' + resultado.id + ' recebido!');
  } catch (erro) {
    console.error('Erro ao enviar o pedido:', erro);
    estado.erroPedido = 'Não conseguimos confirmar seu pedido. Tente enviar novamente.';
  } finally {
    estado.enviando = false;
    render();
  }
}

carregarSessao();
carregarCardapio();
