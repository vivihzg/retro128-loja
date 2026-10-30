/*
 * app.js — vitrine, filtros e carrinho da loja Retrô 128
 */

let CONFIG = null;
let JOGOS = [];
const carrinho = new Map();   // id do jogo -> { jogo, quantidade }
const filtro = { genero: 'Todos', texto: '' };

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarBRL(valor) {
  return BRL.format(valor);
}

/* Preço efetivamente cobrado de um jogo */
function precoDe(jogo) {
  return precoComDesconto(jogo, CONFIG);
}

/* ---------------- Carregamento ---------------- */

function carregarConfig() {
  return Observabilidade.buscarJSON('config/app-config.json');
}

function carregarCatalogo(config) {
  return Observabilidade.buscarJSON(config.catalogoUrl);
}

/* ---------------- Vitrine ---------------- */

function urlCapa(jogo) {
  return CONFIG.pastaCapas + jogo.capa;
}

function renderizarDestaque(jogo) {
  const el = document.getElementById('destaque');
  el.innerHTML = `
    <img class="destaque-capa" src="${urlCapa(jogo)}" alt="Capa de ${jogo.titulo}">
    <div class="destaque-texto">
      <span class="etiqueta">Destaque da semana</span>
      <h2>${jogo.titulo}</h2>
      <p>${jogo.descricao}</p>
      <p class="destaque-meta">${jogo.genero} · ${jogo.ano} · ${jogo.condicao}</p>
      <button class="botao" data-adicionar="${jogo.id}">Adicionar ao carrinho</button>
    </div>`;
}

function criarCard(jogo) {
  const final = precoDe(jogo);
  const precoHtml = final < jogo.preco
    ? `<s>${formatarBRL(jogo.preco)}</s> <strong class="preco-promo">${formatarBRL(final)}</strong>`
    : `<strong>${formatarBRL(final)}</strong>`;

  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = jogo.id;
  card.innerHTML = `
    <div class="card-capa">
      <img src="${urlCapa(jogo)}" alt="Capa de ${jogo.titulo}" loading="lazy">
      ${final < jogo.preco ? `<span class="selo-promo">-${Math.round((1 - final / jogo.preco) * 100)}%</span>` : ''}
    </div>
    <div class="card-corpo">
      <h3>${jogo.titulo}</h3>
      <p class="card-meta">${jogo.genero} · ${jogo.ano}</p>
      <p class="card-condicao">${jogo.condicao} · ${jogo.estoque} em estoque</p>
      <p class="card-preco">${precoHtml}</p>
      <button class="botao botao-pequeno" data-adicionar="${jogo.id}">Adicionar</button>
    </div>`;
  return card;
}

function jogosFiltrados() {
  const texto = filtro.texto.trim().toLowerCase();
  return JOGOS.filter((j) =>
    (filtro.genero === 'Todos' || j.genero === filtro.genero) &&
    (!texto || j.titulo.toLowerCase().includes(texto)));
}

function renderizarCatalogo() {
  const lista = jogosFiltrados();
  const grade = document.getElementById('grade');
  const contagem = document.getElementById('contagem');
  grade.innerHTML = '';
  contagem.textContent = `${JOGOS.length} jogos no catálogo`;

  let exibidos = 0;
  for (const jogo of lista) {
    grade.appendChild(criarCard(jogo));
    exibidos += 1;
    contagem.textContent = `Mostrando ${exibidos} de ${lista.length} jogos`;
  }
  if (lista.length === 0) {
    grade.innerHTML = '<p class="vazio">Nenhum jogo encontrado.</p>';
  }
}

function renderizarFiltros() {
  const generos = ['Todos', ...new Set(JOGOS.map((j) => j.genero))];
  const el = document.getElementById('filtros');
  el.innerHTML = generos
    .map((g) => `<button class="chip${g === filtro.genero ? ' ativo' : ''}" data-genero="${g}">${g}</button>`)
    .join('');
}

/* ---------------- Carrinho ---------------- */

function adicionarAoCarrinho(id) {
  const jogo = JOGOS.find((j) => j.id === id);
  if (!jogo) return;
  const item = carrinho.get(id) || { jogo, quantidade: 0 };
  if (item.quantidade >= jogo.estoque) {
    avisar(`Só temos ${jogo.estoque} unidade(s) de ${jogo.titulo}.`);
    return;
  }
  item.quantidade += 1;
  carrinho.set(id, item);
  Observabilidade.info('CARRINHO_ADICIONOU', jogo.titulo, { id, quantidade: item.quantidade });
  renderizarCarrinho();
  avisar(`${jogo.titulo} foi para o carrinho.`);
}

function removerDoCarrinho(id) {
  carrinho.delete(id);
  renderizarCarrinho();
}

function totalCarrinho() {
  let total = 0;
  for (const { jogo, quantidade } of carrinho.values()) {
    total += precoDe(jogo) * quantidade;
  }
  return Math.round(total * 100) / 100;
}

function renderizarCarrinho() {
  const itens = [...carrinho.values()];
  const qtd = itens.reduce((s, i) => s + i.quantidade, 0);
  document.getElementById('carrinho-qtd').textContent = qtd;

  const lista = document.getElementById('carrinho-itens');
  lista.innerHTML = itens.length
    ? itens.map(({ jogo, quantidade }) => `
        <li>
          <img src="${urlCapa(jogo)}" alt="">
          <div><strong>${jogo.titulo}</strong><br>${quantidade} × ${formatarBRL(precoDe(jogo))}</div>
          <button class="remover" data-remover="${jogo.id}" aria-label="Remover">✕</button>
        </li>`).join('')
    : '<li class="vazio">Seu carrinho está vazio.</li>';

  const total = totalCarrinho();
  document.getElementById('carrinho-total').textContent = formatarBRL(total);
  const falta = CONFIG.freteGratisAcima - total;
  document.getElementById('carrinho-frete').textContent = total === 0 ? ''
    : falta > 0 ? `Faltam ${formatarBRL(falta)} para frete grátis.` : 'Frete grátis garantido!';
}

function finalizarCompra() {
  if (carrinho.size === 0) return;
  const total = totalCarrinho();
  Observabilidade.info('PEDIDO_SIMULADO', `Pedido de ${formatarBRL(total)}`, {
    itens: [...carrinho.values()].map((i) => ({ id: i.jogo.id, qtd: i.quantidade })), total
  });
  carrinho.clear();
  renderizarCarrinho();
  alternarCarrinho(false);
  avisar(`Pedido simulado de ${formatarBRL(total)} registrado. Obrigado!`);
}

function alternarCarrinho(abrir) {
  document.getElementById('carrinho').classList.toggle('aberto', abrir);
}

let temporizadorAviso = null;
function avisar(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.add('visivel');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.classList.remove('visivel'), 2500);
}

/* ---------------- Verificação de saúde ---------------- */

function verificarSaude() {
  const cards = document.querySelectorAll('#grade .card').length;
  const esperado = jogosFiltrados().length;
  const imagens = [...document.querySelectorAll('#vitrine img')];
  const quebradas = imagens.filter((img) => img.complete && img.naturalWidth === 0).length;
  const dados = { cardsExibidos: cards, cardsEsperados: esperado, imagens: imagens.length, imagensQuebradas: quebradas };
  if (cards !== esperado || quebradas > 0 || esperado === 0) {
    Observabilidade.alerta('SAUDE_DEGRADADA',
      `vitrine com ${cards}/${esperado} jogos e ${quebradas} imagem(ns) quebrada(s)`, dados);
  } else {
    Observabilidade.info('SAUDE_OK', `vitrine com ${cards}/${esperado} jogos, imagens ok`, dados);
  }
}

/* ---------------- Eventos ---------------- */

document.addEventListener('click', (ev) => {
  const alvo = ev.target.closest('button');
  if (!alvo) return;
  if (alvo.dataset.adicionar) adicionarAoCarrinho(alvo.dataset.adicionar);
  if (alvo.dataset.remover) removerDoCarrinho(alvo.dataset.remover);
  if (alvo.dataset.genero) {
    filtro.genero = alvo.dataset.genero;
    renderizarFiltros();
    renderizarCatalogo();
  }
  if (alvo.id === 'abrir-carrinho') alternarCarrinho(true);
  if (alvo.id === 'fechar-carrinho') alternarCarrinho(false);
  if (alvo.id === 'finalizar') finalizarCompra();
});

document.getElementById('busca').addEventListener('input', (ev) => {
  filtro.texto = ev.target.value;
  renderizarCatalogo();
});

/* ---------------- Inicialização ---------------- */

async function iniciar() {
  await Observabilidade.iniciar();
  setTimeout(verificarSaude, 5000);

  CONFIG = await carregarConfig();
  Observabilidade.definirVersaoApp(CONFIG.versao);
  const build = Observabilidade.contexto();
  document.getElementById('versao').textContent =
    `versão ${CONFIG.versao} · build ${build.ref} @ ${build.commit}`;

  const catalogo = await carregarCatalogo(CONFIG);
  JOGOS = catalogo.jogos;
  renderizarDestaque(JOGOS[0]);
  renderizarCarrinho();

  // Campanha Black Friday (RET-203): remova as duas barras da linha abaixo para ligar o contador
  // if (CONFIG.blackFriday.ativa) iniciarContador(CONFIG.blackFriday);

  renderizarFiltros();
  renderizarCatalogo();
  Observabilidade.info('APP_PRONTA', `Loja pronta com ${JOGOS.length} jogos`, { versao: CONFIG.versao });
}

iniciar().catch((erro) => {
  Observabilidade.erro('FALHA_INICIALIZACAO', erro.message, { pilha: erro.stack });
});
