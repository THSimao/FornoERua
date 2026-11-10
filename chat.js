const ChatConfig = {
  async onSend(mensagens) {
    const historico = mensagens.slice(-7);
    if (historico[0].role === 'assistant') historico.shift();
    const resposta = await fetch(API + '/atendimento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagens: historico }),
      signal: AbortSignal.timeout(24000),
    });
    if (!resposta.ok) throw new Error('Atendimento indisponível.');
    const dados = await resposta.json();
    return dados.resposta;
  },
};

(function () {
  const boasVindas = { role: 'assistant', content: 'Olá! Boas-vindas à Forno & Rua. Precisa de uma mão para escolher sua pizza ou tirar uma dúvida? Veja as respostas rápidas abaixo.' };
  const assuntos = [
    { titulo: 'Prazo e entrega', resposta: 'A estimativa é de 35–50 minutos, sujeita à localização e à demanda. No carrinho, informe seu CEP para visualizar o frete simulado desta demonstração.' },
    { titulo: 'Horário de atendimento', resposta: 'Nosso horário de atendimento é todos os dias, das 18h às 23h.' },
    { titulo: 'Opções vegetarianas', resposta: 'Procure o símbolo de folha nos produtos do cardápio. Em caso de alergia, confirme os ingredientes com a loja antes de pedir.' },
    { titulo: 'Ajuda com meu pedido', resposta: 'Guarde o número que apareceu na confirmação e informe esse número à loja para consultar o pedido.' },
  ];

  let aberto = false;
  let ocupado = false;
  let mensagens = [boasVindas];
  let erro = '';

  const raiz = document.getElementById('chat-raiz');
  raiz.innerHTML = `<div class="support-widget">
    <section id="support-chat" class="support-panel" role="dialog" aria-modal="false" aria-labelledby="support-title" hidden>
      <div class="support-heading">
        <span class="support-symbol">${icone('chat', 20, 1.7)}</span>
        <div><h2 id="support-title">Uma mão por aqui?</h2><p>Atendimento Forno &amp; Rua</p></div>
        <button type="button" class="support-icon-button" id="chat-fechar" aria-label="Fechar atendimento">${icone('close', 20, 1.7)}</button>
      </div>
      <div class="support-mode"><span></span><em id="chat-modo" style="font-style:normal"></em></div>
      <div class="support-log" id="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversa de atendimento"></div>
      <div class="support-topics"><p>POSSO AJUDAR COM…</p><div id="chat-assuntos"></div></div>
      <form class="support-composer" id="chat-form">
        <label class="support-sr-only" for="support-message">Sua mensagem para o atendimento</label>
        <textarea id="support-message" placeholder="Como podemos ajudar?" maxlength="900" rows="2"></textarea>
        <button type="submit" id="chat-enviar" aria-label="Enviar mensagem" disabled>${icone('send', 20, 1.7)}</button>
      </form>
      <div class="support-bottom"><p id="chat-aviso"></p><button type="button" id="chat-limpar" aria-label="Limpar conversa">${icone('refresh', 20, 1.7)}</button></div>
    </section>
    <button type="button" class="support-launcher" id="chat-abrir" aria-expanded="false" aria-controls="support-chat"></button>
  </div>`;

  const painel = document.getElementById('support-chat');
  const lancador = document.getElementById('chat-abrir');
  const log = document.getElementById('chat-log');
  const campoTexto = document.getElementById('support-message');
  const botaoEnviar = document.getElementById('chat-enviar');
  const botoesAssunto = document.getElementById('chat-assuntos');

  assuntos.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${a.titulo}<span>↗</span>`;
    b.addEventListener('click', () => enviar(a.titulo, a.resposta));
    botoesAssunto.appendChild(b);
  });

  function criarEl(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function desenharLog() {
    log.innerHTML = '';
    log.appendChild(criarEl('p', 'support-day', 'Vamos conversar'));
    mensagens.forEach((m) => {
      const caixa = criarEl('div', `support-message ${m.role}`);
      caixa.appendChild(criarEl('span', '', m.role === 'user' ? 'Você' : 'Atendimento'));
      caixa.appendChild(criarEl('p', '', m.content));
      log.appendChild(caixa);
    });
    if (ocupado) {
      const p = criarEl('p', 'support-pending', 'Buscando uma resposta…');
      p.setAttribute('role', 'status');
      log.appendChild(p);
    }
    if (erro) {
      const p = criarEl('p', 'support-error', erro);
      p.setAttribute('role', 'alert');
      log.appendChild(p);
    }
    log.scrollTop = log.scrollHeight;
    document.getElementById('chat-modo').textContent = 'Atendimento automático';
    document.getElementById('chat-aviso').textContent = 'Evite enviar dados pessoais ou de pagamento.';
    atualizarBotoes();
  }

  function atualizarBotoes() {
    botaoEnviar.disabled = !campoTexto.value.trim() || ocupado;
    botoesAssunto.querySelectorAll('button').forEach((b) => (b.disabled = ocupado));
    document.getElementById('chat-limpar').disabled = ocupado;
  }

  function atualizarLancador() {
    lancador.className = `support-launcher ${aberto ? 'is-open' : ''}`;
    lancador.setAttribute('aria-expanded', aberto);
    lancador.setAttribute('aria-label', aberto ? 'Fechar chat de atendimento' : 'Abrir chat de atendimento');
    lancador.innerHTML = `${icone(aberto ? 'close' : 'chat', 20, 1.7)}<span>${aberto ? 'Fechar' : 'Precisa de ajuda?'}</span>`;
  }

  function abrir() {
    aberto = true;
    painel.hidden = false;
    atualizarLancador();
    desenharLog();
    campoTexto.focus();
  }

  function fechar() {
    aberto = false;
    painel.hidden = true;
    atualizarLancador();
    lancador.focus();
  }

  async function enviar(texto, respostaRapida) {
    const conteudo = texto.trim();
    if (!conteudo || ocupado) return;
    erro = '';
    const proximas = [...mensagens, { role: 'user', content: conteudo }];
    mensagens = proximas;
    campoTexto.value = '';

    if (respostaRapida) {
      mensagens = [...proximas, { role: 'assistant', content: respostaRapida }];
      desenharLog();
      campoTexto.focus();
      return;
    }

    ocupado = true;
    desenharLog();
    try {
      const resposta = await ChatConfig.onSend(proximas);
      if (!resposta || !resposta.trim()) throw new Error('Resposta vazia');
      mensagens = [...proximas, { role: 'assistant', content: resposta.slice(0, 900) }];
    } catch (err) {
      mensagens = proximas.slice(0, -1);
      erro = 'O atendimento automático está indisponível. Use as respostas rápidas ou tente de novo.';
      campoTexto.value = conteudo;
    } finally {
      ocupado = false;
      desenharLog();
    }
  }

  lancador.addEventListener('click', () => (aberto ? fechar() : abrir()));
  document.getElementById('chat-fechar').addEventListener('click', fechar);
  painel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      fechar();
    }
  });
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    enviar(campoTexto.value);
  });
  campoTexto.addEventListener('input', atualizarBotoes);
  campoTexto.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      enviar(campoTexto.value);
    }
  });
  document.getElementById('chat-limpar').addEventListener('click', () => {
    mensagens = [boasVindas];
    erro = '';
    campoTexto.value = '';
    desenharLog();
    campoTexto.focus();
  });

  atualizarLancador();
})();
