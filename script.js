'use strict';

/* Finanças da Telma — os dados ficam somente neste navegador (localStorage). */

const CHAVE = 'financas-telma-v1';
const INICIO = '2026-11';
const ARQUIVO_INICIAL = 'dados-telma.json';
const ENDERECO_PUBLICO = 'https://matheus-ferrari.github.io/financas-telma/';
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CATEGORIAS = ['Mercado', 'Alimentação', 'Farmácia e saúde', 'Transporte', 'Casa', 'Contas da casa', 'Telefone e internet', 'Roupas e compras', 'Pets', 'Igreja e doações', 'Viagem', 'Lazer', 'Outros'];
/* Lojas com ícone público (o ícone vem do serviço do DuckDuckGo; sem ícone, mostra o emoji da categoria). */
const MARCAS = [
  [/ifood/i, 'ifood.com.br'], [/uber/i, 'uber.com'], [/keeta/i, 'keeta.com'], [/drogaria s[aã]o paulo/i, 'drogariasaopaulo.com.br'],
  [/promofarma/i, 'promofarma.com.br'], [/pague menos/i, 'paguemenos.com.br'], [/extra ?farma/i, 'extrafarma.com.br'],
  [/dr\.? ?consulta/i, 'drconsulta.com'], [/cvc/i, 'cvc.com.br'], [/carrefour/i, 'carrefour.com'],
  [/petz/i, 'petz.com.br'], [/shein/i, 'shein.com'], [/vivo/i, 'vivo.com.br'], [/^mp \*/i, 'mercadopago.com.br'],
  [/ita[uú]/i, 'itau.com.br'], [/bradesco/i, 'bradesco.com.br'],
];
const ICONES = { 'Mercado': '🛒', 'Alimentação': '🍽️', 'Farmácia e saúde': '💊', 'Transporte': '🚗', 'Casa': '🏠', 'Contas da casa': '💡', 'Telefone e internet': '📱', 'Roupas e compras': '🛍️', 'Pets': '🐾', 'Igreja e doações': '⛪', 'Viagem': '✈️', 'Lazer': '🎉', 'Outros': '📦' };
const DIVIDIR_SUGERIDO = /swift|merc[uú]rio|sendas/i;
const NOME_SEM_CARTAO = 'Outras contas (boleto, Pix, dinheiro)';
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

let estado;
let mesAtual = INICIO;
let mesUltimo = INICIO;
let erroSalvar = false;
let divisaoTocada = false;
let ajudaAberta = false;
const gruposAbertos = new Set();

const $ = seletor => document.querySelector(seletor);
const somar = (lista, f) => lista.reduce((t, x) => t + f(x), 0);
const agora = () => new Date().toISOString();

/* ---------- dinheiro (sempre em centavos) ---------- */

function reais(c) {
  const sinal = c < 0 ? '− ' : '';
  c = Math.abs(c);
  const inteiro = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sinal}R$ ${inteiro},${String(c % 100).padStart(2, '0')}`;
}

function textoValor(c) {
  return reais(c).replace('R$ ', '');
}

/* Aceita "1.469,28", "1469,28", "30.80" ou "30". Devolve centavos ou null. */
function lerReais(texto) {
  let s = String(texto || '').replace(/R\$|\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [inteiro, decimal = ''] = s.split('.');
  return Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
}

/* Divide em n partes que somam exatamente o total. Centavos que sobram vão para as primeiras partes;
   a primeira é a da Telma, para nunca mostrar menos do que ela deve. */
function dividir(total, n) {
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, k) => base + (k < resto ? 1 : 0));
}

/* Quanto a Telma paga do lançamento: o valor todo ou, se a compra é dividida, só a parte dela. */
function parteTelma(item) {
  return dividir(item.valor, item.dividirPor)[0];
}

/* ---------- meses e datas ---------- */

function mesNum(m) {
  const [a, b] = m.split('-').map(Number);
  return a * 12 + b - 1;
}
function numMes(n) {
  return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`;
}
function somarMeses(m, k) {
  return numMes(mesNum(m) + k);
}
function mesesEntre(de, ate) {
  const r = [];
  for (let n = mesNum(de); n <= mesNum(ate); n++) r.push(numMes(n));
  return r;
}
function nomeMes(m) {
  const [a, b] = m.split('-').map(Number);
  return `${NOMES_MESES[b - 1]} de ${a}`;
}
function nomeMesCurto(m) {
  const [a, b] = m.split('-').map(Number);
  return `${NOMES_MESES[b - 1].slice(0, 3).toLowerCase()}/${a}`;
}
function dataBR(d) {
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}
function dataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}
function esc(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- regras ---------- */

/* Diz se o lançamento aparece no mês. Parcelas e contas fixas são calculadas a partir de um único
   cadastro, por isso editar atualiza os meses futuros sem criar cópias. */
function ocorre(item, mes) {
  const d = mesNum(mes) - mesNum(item.mes);
  if (item.repeticao === 'parcelada') {
    const parcela = item.parcelaAtual + d;
    return parcela >= 1 && parcela <= item.parcelaTotal ? { parcela } : null;
  }
  if (item.repeticao === 'mensal') return d >= 0 && (!item.mesFim || mes <= item.mesFim) ? {} : null;
  return d === 0 ? {} : null;
}

function vencimentoNoMes(item, mes) {
  if (!item.vencimento) return '';
  const [a, m, dia] = item.vencimento.split('-').map(Number);
  const n = a * 12 + m - 1 + mesNum(mes) - mesNum(item.mes);
  const ano = Math.floor(n / 12), mm = n % 12 + 1;
  const ultimoDia = new Date(ano, mm, 0).getDate();
  return `${ano}-${String(mm).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
}

function linha(item, mes) {
  const o = ocorre(item, mes);
  if (!o) return null;
  return {
    item,
    mes,
    parcela: o.parcela,
    valor: item.valor,       // valor cheio que aparece na fatura
    telma: parteTelma(item), // o que a Telma paga
    pago: Boolean(item.pagos[mes]),
    vencimento: vencimentoNoMes(item, mes),
  };
}

function linhasDoMes(mes, tipo) {
  const r = [];
  for (const item of estado.itens) {
    if (item.tipo !== tipo) continue;
    const l = linha(item, mes);
    if (l) r.push(l);
  }
  return r;
}

function resumoMes(mes) {
  const r = { despesas: 0, pendentes: 0, parcelas: 0, fixas: 0, avulsas: 0 };
  for (const l of linhasDoMes(mes, 'despesa')) {
    r.despesas += l.telma;
    if (!l.pago) r.pendentes += l.telma;
    r[{ parcelada: 'parcelas', mensal: 'fixas', unica: 'avulsas' }[l.item.repeticao]] += l.telma;
  }
  return r;
}

/* Contas não pagas de meses anteriores ao escolhido (a partir de novembro/2026). */
function atrasados(mes) {
  return somar(mesesEntre(INICIO, somarMeses(mes, -1)), m => resumoMes(m).pendentes);
}

function listaCartoes() {
  const lista = [];
  for (const i of estado.itens) if (i.tipo === 'despesa' && i.cartao && !lista.includes(i.cartao)) lista.push(i.cartao);
  return lista;
}

function acharItem(id) {
  return estado.itens.find(i => i.id === id);
}

function novoId() {
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Remove marcações de meses que deixaram de existir depois de uma edição. */
function limparMarcas(item) {
  for (const m of Object.keys(item.pagos)) if (!ocorre(item, m)) delete item.pagos[m];
}

/* ---------- armazenamento ---------- */

function estadoVazio() {
  return { app: 'financas-da-telma', versao: 2, saldo: null, itens: [], conferencias: [], ultimoBackup: '', linkImportado: '' };
}

function normalizarItem(x, n) {
  const erro = msg => { throw new Error(`lançamento ${n}: ${msg}`); };
  if (!x || typeof x !== 'object') erro('formato inválido');
  const descricao = String(x.descricao || '').trim();
  if (!descricao) erro('sem descrição');
  if (!Number.isInteger(x.valor) || x.valor < 0) erro('o valor deve estar em centavos (número inteiro)');
  if (!MES_RE.test(x.mes)) erro('mês inválido');
  const tipo = x.tipo === 'receita' ? 'receita' : 'despesa';
  const repeticao = ['unica', 'parcelada', 'mensal'].includes(x.repeticao) ? x.repeticao : 'unica';
  const pagos = {};
  if (x.pagos && typeof x.pagos === 'object') {
    for (const [k, v] of Object.entries(x.pagos)) if (MES_RE.test(k) && typeof v === 'string' && v) pagos[k] = v;
  }
  const item = {
    id: typeof x.id === 'string' && x.id ? x.id : novoId(),
    tipo,
    descricao,
    valor: x.valor,
    repeticao,
    mes: x.mes,
    parcelaAtual: 0,
    parcelaTotal: 0,
    mesFim: repeticao === 'mensal' && MES_RE.test(x.mesFim) ? x.mesFim : '',
    cartao: tipo === 'despesa' ? String(x.cartao || '').trim() : '',
    categoria: String(x.categoria || ''),
    dataCompra: DATA_RE.test(x.dataCompra) ? x.dataCompra : '',
    vencimento: DATA_RE.test(x.vencimento) ? x.vencimento : '',
    dividirPor: Number.isInteger(x.dividirPor) && x.dividirPor >= 1 && x.dividirPor <= 10 && tipo === 'despesa' ? x.dividirPor : 1,
    obs: String(x.obs || ''),
    pagos,
  };
  if (repeticao === 'parcelada') {
    const { parcelaAtual: a, parcelaTotal: t } = x;
    if (!Number.isInteger(t) || !Number.isInteger(a) || t < 1 || a < 1 || a > t) erro('parcelas inválidas');
    item.parcelaAtual = a;
    item.parcelaTotal = t;
  }
  limparMarcas(item);
  return item;
}

function normalizar(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.itens)) throw new Error('este arquivo não é um backup das Finanças da Telma.');
  const ids = new Set();
  const itens = d.itens.map((x, k) => {
    const item = normalizarItem(x, k + 1);
    if (ids.has(item.id)) item.id = novoId();
    ids.add(item.id);
    return item;
  });
  const s = d.saldo;
  const saldo = s && Number.isInteger(s.valor) && typeof s.data === 'string' ? { valor: s.valor, data: s.data } : null;
  const conferencias = (Array.isArray(d.conferencias) ? d.conferencias : [])
    .filter(c => c && typeof c.cartao === 'string' && MES_RE.test(c.mes) && Number.isInteger(c.valor) && c.valor >= 0)
    .map(c => ({ cartao: c.cartao, mes: c.mes, valor: c.valor }));
  return { ...estadoVazio(), saldo, itens, conferencias,
    ultimoBackup: typeof d.ultimoBackup === 'string' ? d.ultimoBackup : '',
    linkImportado: typeof d.linkImportado === 'string' ? d.linkImportado : '',
  };
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    erroSalvar = false;
  } catch (e) {
    erroSalvar = true;
  }
}

/* null = primeira vez neste navegador. */
function carregar() {
  let texto;
  try {
    texto = localStorage.getItem(CHAVE);
  } catch (e) {
    erroSalvar = true;
    return estadoVazio();
  }
  if (!texto) return null;
  try {
    return normalizar(JSON.parse(texto));
  } catch (e) {
    try { localStorage.setItem(`${CHAVE}-com-erro-${Date.now()}`, texto); } catch (_) { /* sem espaço */ }
    alert('Os dados salvos neste aparelho estão danificados. Uma cópia foi guardada. Abra um backup em “Backup”.');
    return estadoVazio();
  }
}

/* ---------- pedaços de tela ---------- */

function bloco(icone, titulo, valor, explica, classe = '') {
  return `<div class="bloco ${classe}">
    <div class="bloco-titulo"><span class="bloco-icone" aria-hidden="true">${icone}</span>${titulo}</div>
    <div class="bloco-valor">${valor}</div>
    <p class="bloco-explica">${explica}</p>
  </div>`;
}

/* Tabelinha de rótulo e valor: [rótulo, valor, classe?] */
function mini(linhas) {
  return `<dl class="mini">${linhas.map(([rotulo, valor, classe = '']) => `<div class="${classe}"><dt>${rotulo}</dt><dd>${valor}</dd></div>`).join('')}</dl>`;
}

function numero(rotulo, valor, classe = '') {
  return `<span class="num ${classe}"><small>${rotulo}</small><strong>${valor}</strong></span>`;
}

function logo(texto, emoji = '🧾') {
  const marca = MARCAS.find(([re]) => re.test(texto));
  if (!marca) return `<span class="logo" aria-hidden="true">${emoji || '🧾'}</span>`;
  return `<img class="logo" src="https://icons.duckduckgo.com/ip3/${marca[1]}.ico" alt="" width="24" height="24" loading="lazy" data-e="${emoji || '🧾'}" onerror="this.outerHTML='<span class=logo>'+this.dataset.e+'</span>'">`;
}

/* Gasto da Telma no mês por categoria, do maior para o menor: [categoria, total, lançamentos]. */
function porCategoria(mes) {
  const t = {};
  for (const l of linhasDoMes(mes, 'despesa')) (t[l.item.categoria || 'Sem categoria'] ||= []).push(l);
  return Object.entries(t)
    .map(([c, ls]) => [c, somar(ls, l => l.telma), ls.sort((a, b) => b.telma - a.telma)])
    .sort((a, b) => b[1] - a[1]);
}

function categoriasHtml(mes, total) {
  const lista = porCategoria(mes);
  if (!lista.length || !total) return '';
  const maior = lista[0][1];
  const pct = v => Math.round(v / total * 100);
  const [nome, valor] = lista[0];
  return `<section class="cartao">
    <h2>Para onde vai o dinheiro</h2>
    <p class="destaque-frase">A Telma está gastando mais com <strong>${esc(nome)}</strong>: <strong>${reais(valor)}</strong> (${pct(valor)}% das despesas do mês).</p>
    <div class="categorias">
      ${lista.map(([c, v, linhas]) => `<details class="cat" data-grupo="cat:${esc(c)}"${gruposAbertos.has('cat:' + c) ? ' open' : ''}>
        <summary>
          <span class="cat-topo"><span>${ICONES[c] || '❔'} ${esc(c)}</span><span><strong>${reais(v)}</strong> · ${pct(v)}%</span></span>
          <span class="barra"><span style="width:${Math.max(1, Math.round(v / maior * 100))}%"></span></span>
        </summary>
        <ul class="cat-itens">${linhas.map(l => `<li>${logo(l.item.descricao, ICONES[c])}<span>${esc(l.item.descricao)}<small>${esc(l.item.cartao || NOME_SEM_CARTAO)}</small></span><strong>${reais(l.telma)}</strong></li>`).join('')}</ul>
      </details>`).join('')}
    </div>
    <p class="ajuda">Toque em uma categoria para ver as compras dela. Conta só a parte da Telma.</p>
  </section>`;
}

/* ---------- telas ---------- */

function telaMes() {
  const r = resumoMes(mesAtual);
  const atraso = atrasados(mesAtual);
  const comprometido = somar(Array.from({ length: 11 }, (_, k) => somarMeses(mesAtual, k + 1)), m => resumoMes(m).despesas);
  const linhas = linhasDoMes(mesAtual, 'despesa');
  const grupos = [...listaCartoes(), '']
    .map(c => [c, linhas.filter(l => l.item.cartao === c)])
    .filter(([, ls]) => ls.length);

  return `
    ${estado.itens.length ? '' : `<section class="cartao">
      <h2>Bem-vinda!</h2>
      <p>Este aparelho ainda não tem os gastos da Telma.</p>
      <p>Para ver tudo, abra o <strong>link com os dados</strong> que foi enviado pelo WhatsApp. Este site não guarda os dados: eles chegam pelo link e ficam só neste aparelho.</p>
      <div class="botoes">
        <button type="button" class="btn" data-acao="importar">📂 Abrir arquivo de backup</button>
      </div>
    </section>`}

    <section class="cartao">
      <div class="titulo-secao">
        <h2>Resumo de ${nomeMes(mesAtual)}</h2>
        <p class="aviso-parcial">Dados parciais: só aparece o que foi cadastrado.</p>
      </div>
      <div class="painel">
        ${bloco('🧾', 'Despesas do mês', reais(r.despesas), 'Tudo o que a Telma paga neste mês. Nas compras divididas, conta só a parte dela.')}
        ${bloco('⏳', 'Contas pendentes', reais(r.pendentes), 'O que ainda falta pagar neste mês.', 'destaque')}
        ${bloco('📅', 'Já comprometido depois', reais(comprometido), 'Parcelas e contas fixas que já vão cair nos próximos 11 meses.')}
      </div>
      ${atraso ? `<p class="alerta">⚠ Contas de meses anteriores ainda não marcadas como pagas: ${reais(atraso)}.</p>` : ''}
    </section>

    ${categoriasHtml(mesAtual, r.despesas)}

    <details class="cartao como-usar" data-ajuda${ajudaAberta ? ' open' : ''}>
      <summary>❓ Como usar esta tela</summary>
      <ol>
        <li>Escolha o mês lá em cima, nas setas.</li>
        <li>Toque em uma categoria ou em um cartão para ver as compras.</li>
        <li>Compras divididas com outras pessoas mostram só a parte da Telma.</li>
        <li>Pagou uma conta? Toque em <strong>Marcar como pago</strong>. Pagou tudo de um cartão? Use <strong>Paguei tudo deste cartão</strong>.</li>
        <li>De vez em quando, toque em <strong>Salvar backup</strong>, no fim da página.</li>
      </ol>
    </details>

    <div class="titulo-secao">
      <h2>Contas de ${nomeMes(mesAtual)}</h2>
      <button type="button" class="btn btn-principal" data-acao="nova-despesa">+ Adicionar conta</button>
    </div>
    ${grupos.length ? grupos.map(([c, ls]) => grupoHtml(c, ls)).join('') : '<p class="vazio">Nenhuma conta cadastrada para este mês.</p>'}

    <footer class="rodape">
      <p>Os dados ficam só neste aparelho. Salve um backup de vez em quando${estado.ultimoBackup ? ` (último: ${dataHora(estado.ultimoBackup)})` : ''}.</p>
      <button type="button" class="btn-link" data-acao="exportar">💾 Salvar backup</button>
      <button type="button" class="btn-link" data-acao="importar">📂 Abrir backup</button>
      <button type="button" class="btn-link" data-acao="enviar-link">📲 Enviar link com os dados</button>
      <p class="ajuda">Quem abrir o link vê todos os dados: envie só para a Telma.</p>
    </footer>`;
}

function grupoHtml(cartao, linhas) {
  const telma = somar(linhas, l => l.telma);
  const pendente = somar(linhas.filter(l => !l.pago), l => l.telma);
  const cheio = somar(linhas, l => l.valor);
  const conf = cartao && estado.conferencias.find(c => c.cartao === cartao && c.mes === mesAtual);
  const diferenca = conf ? cheio - conf.valor : 0;
  const attr = esc(cartao);

  return `<details class="grupo" data-grupo="${attr}"${gruposAbertos.has(cartao) ? ' open' : ''}>
    <summary>
      <span class="grupo-cabeca">${logo(cartao, '💳')}<span>
        <span class="grupo-nome">${esc(cartao || NOME_SEM_CARTAO)}</span>
        <span class="grupo-qtd">${plural(linhas.length, 'lançamento', 'lançamentos')}</span>
      </span></span>
      <span class="grupo-numeros">
        ${numero('A Telma paga', reais(telma))}
        ${numero('Falta pagar', pendente ? reais(pendente) : '✓ Tudo pago', pendente ? 'pendente' : 'ok')}
      </span>
      ${diferenca ? '<span class="grupo-alerta">⚠ Conferir lançamentos</span>' : ''}
      <span class="grupo-abrir"><span class="ver">▼ Ver as compras</span><span class="esconder">▲ Esconder as compras</span></span>
    </summary>
    <div class="grupo-corpo">
      ${cartao ? `<div class="grupo-acoes">
        <button type="button" class="btn ${pendente ? 'btn-marcar' : ''}" data-acao="pagar-fatura" data-cartao="${attr}">${pendente ? 'Paguei tudo deste cartão' : 'Desfazer: ainda não foi pago'}</button>
        <button type="button" class="btn-link" data-acao="renomear" data-cartao="${attr}">Renomear cartão</button>
      </div>` : ''}
      ${diferenca ? `<p class="alerta">⚠ Conferir lançamentos: a soma (${reais(cheio)}) está ${reais(Math.abs(diferenca))} ${diferenca > 0 ? 'acima' : 'abaixo'} da fatura do banco (${reais(conf.valor)}). <button type="button" class="btn-link" data-acao="conferir" data-cartao="${attr}">Corrigir valor da fatura</button></p>` : ''}
      <div class="itens">${linhas.map(itemHtml).join('')}</div>
    </div>
  </details>`;
}

function itemHtml(l) {
  const it = l.item;
  const dividida = it.dividirPor > 1;
  const info = [];
  if (it.dataCompra) info.push(`Compra em ${dataBR(it.dataCompra)}`);
  if (l.parcela) info.push(`Parcela ${l.parcela} de ${it.parcelaTotal}`);
  else if (it.repeticao === 'mensal') info.push(`Todo mês${it.mesFim ? ` até ${nomeMesCurto(it.mesFim)}` : ''}`);
  else info.push('Compra única');
  if (l.vencimento) info.push(`Vence em ${dataBR(l.vencimento)}`);
  if (it.categoria) info.push(it.categoria);

  const tabela = [];
  if (l.parcela) {
    const faltam = it.parcelaTotal - l.parcela;
    const total = reais(it.valor * it.parcelaTotal);
    if (!dividida) tabela.push(['Valor da parcela', reais(l.valor)]);
    tabela.push(['Total da compra', dividida ? `${total} (parte da Telma: ${reais(l.telma * it.parcelaTotal)})` : total]);
    tabela.push(['Depois deste mês', faltam ? `${plural(faltam, 'parcela', 'parcelas')} = ${reais(faltam * l.telma)}, até ${nomeMesCurto(somarMeses(l.mes, faltam))}` : 'Esta é a última parcela']);
  }

  const rotulo = l.pago ? '✓ Pago' : 'Marcar como pago';
  return `<article class="item${l.pago ? ' pago' : ''}">
    <div class="item-topo">
      <h3>${logo(it.descricao, ICONES[it.categoria])}${esc(it.descricao)}</h3>
      <span class="item-valor">${reais(l.telma)}${dividida ? '<small>parte da Telma</small>' : ''}</span>
    </div>
    <p class="item-info">${esc(info.join(' · '))}</p>
    ${dividida ? `<p class="referente">Referente a <strong>1/${it.dividirPor}</strong> ${l.parcela ? 'da parcela' : 'da compra'} de ${reais(l.valor)}, dividida entre ${it.dividirPor} pessoas.</p>` : ''}
    ${tabela.length ? mini(tabela) : ''}
    ${it.obs ? `<p class="obs">${esc(it.obs)}</p>` : ''}
    <div class="item-acoes">
      <button type="button" class="btn ${l.pago ? 'btn-ok' : 'btn-marcar'}" data-acao="pago" data-id="${esc(it.id)}" aria-pressed="${l.pago}">${rotulo}</button>
      <button type="button" class="btn" data-acao="editar" data-id="${esc(it.id)}">Editar</button>
    </div>
  </article>`;
}

function render() {
  const sel = $('#mes');
  sel.value = mesAtual;
  $('[data-acao="mes-anterior"]').disabled = mesAtual <= INICIO;
  $('[data-acao="mes-seguinte"]').disabled = mesAtual >= mesUltimo;
  const aviso = erroSalvar ? '<p class="erro">Não foi possível salvar neste navegador (modo anônimo ou sem espaço). Faça um backup para não perder os dados.</p>' : '';
  $('#app').innerHTML = aviso + telaMes();
}

function alterou() {
  salvar();
  render();
}

/* ---------- formulário de lançamento ---------- */

const janela = $('#janela');
const form = $('#form');

function opcoesMeses(meses) {
  return meses.map(m => `<option value="${m}">${nomeMes(m)}</option>`).join('');
}

function garantirOpcao(select, valor, texto) {
  if (valor && ![...select.options].some(o => o.value === valor)) select.add(new Option(texto, valor));
}

function montarFormulario() {
  const f = form.elements;
  const meses = mesesEntre(somarMeses(INICIO, -12), somarMeses(mesUltimo, 12));
  f.mes.innerHTML = opcoesMeses(meses);
  f.mesFim.innerHTML = '<option value="">Sem data para acabar</option>' + opcoesMeses(meses);
  f.categoria.innerHTML = '<option value="">Sem categoria</option>' + CATEGORIAS.map(c => `<option>${esc(c)}</option>`).join('');
  f.dividirPor.innerHTML = '<option value="1">Não, é toda da Telma</option>' +
    [2, 3, 4, 5].map(n => `<option value="${n}">Sim, entre ${n} pessoas (Telma paga 1/${n})</option>`).join('');

  f.descricao.addEventListener('input', () => {
    if (!divisaoTocada) f.dividirPor.value = DIVIDIR_SUGERIDO.test(f.descricao.value) ? '3' : '1';
  });
  f.dividirPor.addEventListener('change', () => { divisaoTocada = true; });
  form.addEventListener('input', atualizarForm);
  form.addEventListener('change', atualizarForm);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const erro = salvarForm();
    if (erro) return mostrarErroForm(erro);
    janela.close();
    alterou();
  });
}

function mostrarErroForm(msg) {
  const el = $('#form-erro');
  el.textContent = msg;
  el.hidden = !msg;
  if (msg) el.scrollIntoView({ block: 'center' });
}

function atualizarForm() {
  const f = form.elements;
  const despesa = f.tipo.value === 'despesa';
  const rep = f.repeticao.value;
  form.querySelectorAll('.so-despesa').forEach(el => { el.hidden = !despesa; });
  form.querySelectorAll('.so-parcelada').forEach(el => { el.hidden = rep !== 'parcelada'; });
  form.querySelectorAll('.so-mensal').forEach(el => { el.hidden = rep !== 'mensal'; });
  $('#campo-novo-cartao').hidden = !(despesa && f.cartao.value === '__novo__');
  $('#aviso-fatura').hidden = !(despesa && /fatura/i.test(f.descricao.value));
  $('#rotulo-mes').textContent = !despesa ? (rep === 'mensal' ? 'A partir de qual mês?' : 'Mês em que recebe')
    : rep === 'parcelada' ? 'Mês da fatura desta parcela'
    : rep === 'mensal' ? 'Primeiro mês a pagar'
    : 'Mês da fatura (mês em que vai pagar)';

  const v = lerReais(f.valor.value);
  const n = Number(f.dividirPor.value);
  let previa = '';
  if (despesa && n > 1 && v) previa = `A Telma paga ${reais(dividir(v, n)[0])} (1/${n} de ${reais(v)}).`;
  else if (despesa && n === 1 && DIVIDIR_SUGERIDO.test(f.descricao.value)) previa = 'Compras no Swift, Mercúrio e Sendas costumam ser divididas entre 3 pessoas.';
  $('#previa-divisao').textContent = previa;
}

function abrirForm(tipo, item) {
  const f = form.elements;
  form.reset();
  mostrarErroForm('');
  f.id.value = item ? item.id : '';
  f.tipo.value = tipo;

  const cartoes = listaCartoes();
  f.cartao.innerHTML = cartoes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('') +
    `<option value="">${NOME_SEM_CARTAO}</option><option value="__novo__">+ Cadastrar novo cartão…</option>`;

  if (item) {
    garantirOpcao(f.mes, item.mes, nomeMes(item.mes));
    garantirOpcao(f.mesFim, item.mesFim, nomeMes(item.mesFim || INICIO));
    garantirOpcao(f.categoria, item.categoria, item.categoria);
    f.descricao.value = item.descricao;
    f.valor.value = textoValor(item.valor);
    f.repeticao.value = item.repeticao;
    f.parcelaAtual.value = item.parcelaAtual || '';
    f.parcelaTotal.value = item.parcelaTotal || '';
    f.mes.value = item.mes;
    f.mesFim.value = item.mesFim;
    f.cartao.value = item.cartao;
    f.dataCompra.value = item.dataCompra;
    f.vencimento.value = item.vencimento;
    f.categoria.value = item.categoria;
    f.dividirPor.value = String(item.dividirPor);
    f.obs.value = item.obs;
    divisaoTocada = true;
  } else {
    f.repeticao.value = 'unica';
    f.parcelaAtual.value = '1';
    f.mes.value = mesAtual;
    f.cartao.value = cartoes[0] || '';
    f.dividirPor.value = '1';
    divisaoTocada = false;
  }

  const nome = tipo === 'receita' ? 'renda' : 'conta';
  $('#form-titulo').textContent = item ? `Editar ${nome}` : `Nova ${nome}`;
  $('#btn-excluir').hidden = !item;
  $('#btn-excluir').textContent = `Excluir esta ${nome}`;
  atualizarForm();
  janela.showModal();
  janela.scrollTop = 0;
}

function salvarForm() {
  const f = form.elements;
  const tipo = f.tipo.value;
  const descricao = f.descricao.value.trim();
  if (!descricao) return 'Escreva a descrição.';
  const valor = lerReais(f.valor.value);
  if (!valor) return 'Informe um valor válido. Exemplo: 30,80';
  const repeticao = tipo === 'receita' && f.repeticao.value === 'parcelada' ? 'unica' : f.repeticao.value;
  const dados = {
    tipo, descricao, valor, repeticao, mes: f.mes.value,
    parcelaAtual: 0, parcelaTotal: 0, mesFim: '',
    cartao: '', categoria: '', dataCompra: '', vencimento: '', dividirPor: 1,
    obs: f.obs.value.trim(),
  };
  if (repeticao === 'parcelada') {
    const atual = Number(f.parcelaAtual.value), total = Number(f.parcelaTotal.value);
    if (!Number.isInteger(total) || total < 1 || total > 120) return 'Informe em quantas parcelas foi feita a compra.';
    if (!Number.isInteger(atual) || atual < 1 || atual > total) return `A parcela nº deve estar entre 1 e ${total}.`;
    dados.parcelaAtual = atual;
    dados.parcelaTotal = total;
  }
  if (repeticao === 'mensal' && f.mesFim.value) {
    if (f.mesFim.value < dados.mes) return 'O mês final não pode ser antes do primeiro mês.';
    dados.mesFim = f.mesFim.value;
  }
  if (tipo === 'despesa') {
    let cartao = f.cartao.value;
    if (cartao === '__novo__') {
      cartao = f.novoCartao.value.trim();
      if (!cartao) return 'Escreva o nome do novo cartão.';
    }
    dados.cartao = cartao;
    dados.categoria = f.categoria.value;
    dados.dataCompra = f.dataCompra.value;
    dados.vencimento = f.vencimento.value;
    dados.dividirPor = Number(f.dividirPor.value) || 1;
  }

  const existente = acharItem(f.id.value);
  if (existente) {
    Object.assign(existente, dados);
    limparMarcas(existente);
  } else {
    estado.itens.push({ id: novoId(), ...dados, pagos: {} });
  }
  return '';
}

function excluirItem() {
  const item = acharItem(form.elements.id.value);
  if (!item) return;
  let msg = `Excluir “${item.descricao}”?`;
  if (item.repeticao === 'parcelada') msg += '\n\nTodas as parcelas desta compra serão apagadas.';
  if (item.repeticao === 'mensal') msg += '\n\nTodos os meses desta conta serão apagados. Para parar só daqui pra frente, use “Até qual mês?”.';
  if (!confirm(msg)) return;
  estado.itens = estado.itens.filter(i => i !== item);
  janela.close();
  alterou();
}

/* ---------- ações ---------- */

function pagarFatura(cartao) {
  const linhas = linhasDoMes(mesAtual, 'despesa').filter(l => l.item.cartao === cartao);
  if (linhas.every(l => l.pago)) {
    if (!confirm(`Desmarcar o pagamento de “${cartao}” em ${nomeMes(mesAtual)}?`)) return;
    linhas.forEach(l => { delete l.item.pagos[mesAtual]; });
  } else {
    const total = somar(linhas, l => l.telma);
    if (!confirm(`Marcar tudo de “${cartao}” em ${nomeMes(mesAtual)} como pago?\n\n${plural(linhas.length, 'lançamento', 'lançamentos')}, total da Telma ${reais(total)}.`)) return;
    const quando = agora();
    linhas.forEach(l => { if (!l.pago) l.item.pagos[mesAtual] = quando; });
  }
  alterou();
}

function renomearCartao(cartao) {
  const novo = (prompt('Novo nome do cartão (pode incluir o final do número):', cartao) || '').trim();
  if (!novo || novo === cartao) return;
  estado.itens.forEach(i => { if (i.cartao === cartao) i.cartao = novo; });
  estado.conferencias.forEach(c => { if (c.cartao === cartao) c.cartao = novo; });
  if (gruposAbertos.delete(cartao)) gruposAbertos.add(novo);
  alterou();
}

function conferir(cartao) {
  const lista = estado.conferencias;
  const atual = lista.find(c => c.cartao === cartao && c.mes === mesAtual);
  const texto = prompt(`Total da fatura “${cartao}” de ${nomeMes(mesAtual)}, como aparece no banco.\nDeixe vazio para remover.`, atual ? textoValor(atual.valor) : '');
  if (texto === null) return;
  estado.conferencias = lista.filter(c => c !== atual);
  if (texto.trim()) {
    const valor = lerReais(texto);
    if (valor === null) {
      alert('Valor inválido. Exemplo: 1.469,28');
      estado.conferencias = lista;
      return;
    }
    estado.conferencias.push({ cartao, mes: mesAtual, valor });
  }
  alterou();
}

function exportar() {
  estado.ultimoBackup = agora();
  salvar();
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `financas-telma-backup-${hojeISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  render();
}

async function importar(arquivo) {
  let novo;
  try {
    novo = normalizar(JSON.parse(await arquivo.text()));
  } catch (e) {
    alert(`Não foi possível abrir o arquivo: ${e.message}`);
    return;
  }
  const temDados = estado.itens.length || estado.saldo;
  if (temDados && !confirm(`Substituir os dados deste aparelho pelos do arquivo “${arquivo.name}”?\n\nNo arquivo: ${plural(novo.itens.length, 'lançamento', 'lançamentos')}.\nNeste aparelho agora: ${plural(estado.itens.length, 'lançamento', 'lançamentos')}.\n\nOs dados atuais serão apagados. Se tiver dúvida, cancele e salve um backup antes.`)) return;
  estado = novo;
  salvar();
  render();
  window.scrollTo(0, 0);
  alert(`Pronto! ${plural(novo.itens.length, 'lançamento aberto', 'lançamentos abertos')}.`);
}

/* ---------- link com os dados (vão depois do #, parte que o navegador nunca envia ao servidor) ---------- */

async function gzipBase64(texto) {
  const gz = await new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  let bin = '';
  new Uint8Array(gz).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function base64Gunzip(codigo) {
  const bytes = Uint8Array.from(atob(codigo.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

async function enviarLink() {
  const base = location.hostname.endsWith('github.io') ? location.href.split('#')[0] : ENDERECO_PUBLICO;
  const url = `${base}#dados=${await gzipBase64(JSON.stringify({ ...estado, geradoEm: agora() }))}`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: 'Finanças da Telma', url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    alert('Link copiado! Cole na conversa do WhatsApp.');
  } catch (e) {
    prompt('Copie o link:', url);
  }
}

/* Abre os dados que vieram no link. O mesmo link aberto de novo é ignorado, para não desfazer o que já foi marcado. */
async function abrirLink() {
  const m = location.hash.match(/^#dados=([\w-]+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const dados = JSON.parse(await base64Gunzip(m[1]));
    if (estado && dados.geradoEm && dados.geradoEm === estado.linkImportado) return;
    if (estado && estado.itens.length && !confirm('Este link traz dados novos. Substituir os dados deste aparelho por eles?')) return;
    estado = normalizar(dados);
    estado.linkImportado = dados.geradoEm || '';
  } catch (e) {
    alert('Não foi possível abrir os dados deste link.');
  }
}

const ACOES = {
  'mes-anterior': () => { mesAtual = somarMeses(mesAtual, -1); render(); },
  'mes-seguinte': () => { mesAtual = somarMeses(mesAtual, 1); render(); },
  'nova-despesa': () => abrirForm('despesa'),
  'editar': b => { const it = acharItem(b.dataset.id); if (it) abrirForm(it.tipo, it); },
  'fechar-form': () => janela.close(),
  'excluir': excluirItem,
  'pago': b => {
    const it = acharItem(b.dataset.id);
    if (!it) return;
    if (it.pagos[mesAtual]) delete it.pagos[mesAtual];
    else it.pagos[mesAtual] = agora();
    alterou();
  },
  'pagar-fatura': b => pagarFatura(b.dataset.cartao),
  'conferir': b => conferir(b.dataset.cartao),
  'renomear': b => renomearCartao(b.dataset.cartao),
  'exportar': exportar,
  'enviar-link': enviarLink,
  'importar': () => $('#arquivo').click(),
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-acao]');
  if (b && ACOES[b.dataset.acao]) ACOES[b.dataset.acao](b);
});

document.addEventListener('toggle', e => {
  const g = e.target;
  if (!g.matches) return;
  if (g.matches('details[data-ajuda]')) ajudaAberta = g.open;
  if (!g.matches('details[data-grupo]')) return;
  if (g.open) gruposAbertos.add(g.dataset.grupo);
  else gruposAbertos.delete(g.dataset.grupo);
}, true);

$('#mes').addEventListener('change', e => { mesAtual = e.target.value; render(); });

$('#arquivo').addEventListener('change', async e => {
  const arquivo = e.target.files[0];
  if (arquivo) await importar(arquivo);
  e.target.value = '';
});

/* ---------- início ---------- */

async function iniciar() {
  const hoje = hojeISO().slice(0, 7);
  mesAtual = hoje > INICIO ? hoje : INICIO;
  mesUltimo = somarMeses(mesAtual, 36);
  $('#mes').innerHTML = opcoesMeses(mesesEntre(INICIO, mesUltimo));
  montarFormulario();

  estado = carregar();
  await abrirLink();
  if (!estado) {
    // Primeira vez neste navegador: usa o arquivo local de dados, se existir (ele não vai para o GitHub).
    estado = estadoVazio();
    if (location.protocol.startsWith('http')) {
      try {
        const r = await fetch(ARQUIVO_INICIAL, { cache: 'no-store' });
        if (r.ok) estado = normalizar(await r.json());
      } catch (e) { /* sem arquivo: começa vazio */ }
    }
  }
  salvar(); // grava já no formato atual (inclusive dados da versão anterior)
  render();
}

iniciar();
