/* ============================================================
   BOM DIA AGRO — arquivo principal
   Junta tudo: login, as três telas, o tema e a exportação.
   ============================================================ */

import { REGIOES, CATEGORIAS, PRODUTOS, PRODUTO_POR_ID, REGIAO_POR_ID } from './config.js';
import { icone } from './icones.js';
import * as Auth from './auth.js';
import * as D from './dados.js';
import { miniGrafico, graficoLinha, graficoBarras, ativarGrafico } from './graficos.js';
import * as Exportar from './exportar.js';

/* ------------------------------------------------------------
   ESTADO — o que o app está mostrando agora
   ------------------------------------------------------------ */
const estado = {
  usuario: null,
  pagina: 'precos',
  regiao: localStorage.getItem('bda_regiao') || 'mt',
  categoria: 'todos',
  periodoNoticias: 'dia',
  g: {
    produtoA: 'boi-gordo',
    produtoB: '',
    regiao: localStorage.getItem('bda_regiao') || 'mt',
    periodo: 'dia',
    base100: false
  }
};

if (!REGIAO_POR_ID[estado.regiao]) { estado.regiao = 'mt'; estado.g.regiao = 'mt'; }

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ============================================================
   TEMA CLARO / ESCURO
   ============================================================ */
function aplicarTema(tema) {
  const raiz = document.documentElement;

  // desliga as animações, troca o tema, repinta, religa as animações
  raiz.classList.add('trocando-tema');
  raiz.setAttribute('data-tema', tema);
  void raiz.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.remove('trocando-tema')));

  localStorage.setItem('bda_tema', tema);
  const claro = tema !== 'escuro';
  $$('.btn-tema').forEach(b => {
    b.innerHTML = icone(claro ? 'lua' : 'sol', 20);
    b.title = claro ? 'Modo escuro' : 'Modo claro';
    b.setAttribute('aria-label', b.title);
  });
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', claro ? '#F7F6F1' : '#0F1613');
}

function alternarTema() {
  aplicarTema(document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro');
}

/* ============================================================
   A FAIXA DO AMANHECER
   Muda de âmbar para verde conforme a hora do dia.
   ============================================================ */
function pintarFaixa() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const paletas = [
    { ate: 5,  a: '#2E4A3A', b: '#17743C' },   // madrugada
    { ate: 8,  a: '#E8A13C', b: '#C6802E' },   // amanhecer — a hora do "bom dia"
    { ate: 12, a: '#C6802E', b: '#17743C' },   // manhã
    { ate: 17, a: '#17743C', b: '#1E8F4A' },   // tarde
    { ate: 20, a: '#C6802E', b: '#17743C' },   // entardecer
    { ate: 24, a: '#2E4A3A', b: '#17743C' }    // noite
  ];
  const p = paletas.find(x => h < x.ate) || paletas[paletas.length - 1];
  document.documentElement.style.setProperty('--faixa-a', p.a);
  document.documentElement.style.setProperty('--faixa-b', p.b);
}

function saudacaoDoDia() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/* ============================================================
   LOGIN
   ============================================================ */
let modoCadastro = false;

function montarLogin() {
  $('#link-trocar').onclick = () => {
    modoCadastro = !modoCadastro;
    $('#campo-nome').classList.toggle('oculto', !modoCadastro);
    $('#campo-convite').classList.toggle('oculto', !(modoCadastro && Auth.exigeConvite()));
    $('#btn-entrar').textContent = modoCadastro ? 'Criar minha conta' : 'Entrar';
    $('#link-trocar').textContent = modoCadastro
      ? 'Já tenho conta — quero entrar'
      : 'Ainda não tenho conta — quero me cadastrar';
    $('#titulo-login').textContent = modoCadastro ? 'Criar conta' : 'Entrar';
    recado('');
    (modoCadastro ? $('#nome') : $('#email')).focus();
  };

  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    const botao = $('#btn-entrar');
    botao.disabled = true;
    recado('');

    try {
      let usuario;
      if (modoCadastro) {
        const r = await Auth.cadastrar($('#nome').value, $('#email').value, $('#senha').value, $('#convite').value);
        if (r.precisaConfirmarEmail) {
          recado('Cadastro criado! Confirme o link que enviamos no seu e-mail e depois entre.', 'ok');
          botao.disabled = false;
          return;
        }
        usuario = r.usuario;
      } else {
        usuario = await Auth.entrar($('#email').value, $('#senha').value);
      }
      await abrirApp(usuario);
    } catch (erro) {
      recado(erro.message, 'erro');
      botao.disabled = false;
    }
  };
}

function recado(texto, tipo = 'erro') {
  const c = $('#recado-login');
  c.innerHTML = texto
    ? `<div class="recado ${tipo}">${icone(tipo === 'ok' ? 'sol' : 'aviso', 16)}<span>${texto}</span></div>`
    : '';
}

/* ============================================================
   ABRIR O APP (depois do login)
   ============================================================ */
async function abrirApp(usuario) {
  estado.usuario = usuario;
  $('#tela-login').classList.add('oculto');
  $('#app').classList.add('ativo');
  $('#saudacao').textContent = `${saudacaoDoDia()}, ${Auth.primeiroNome(usuario)}!`;

  montarFiltros();
  desenharCarregando();

  try {
    await D.carregarPrecos();
  } catch {
    $('#lista-precos').innerHTML = vazio('aviso',
      'Não consegui carregar os preços.',
      'Verifique sua internet e recarregue a página.');
    return;
  }

  montarSeletoresGraficos();
  D.carregarMoedas().then(desenharMoedas);
  D.carregarNoticias().then(() => { if (estado.pagina === 'noticias') desenharNoticias(); });

  desenharTudo();
}

/* ============================================================
   NAVEGAÇÃO ENTRE AS TRÊS TELAS
   ============================================================ */
function irPara(pagina) {
  estado.pagina = pagina;
  $$('.pagina').forEach(p => p.classList.toggle('ativa', p.id === 'pg-' + pagina));
  $$('[data-aba]').forEach(b => b.classList.toggle('ativa', b.dataset.aba === pagina));
  $('#btn-exportar-flutuante').classList.toggle('oculto', pagina !== 'precos');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (pagina === 'noticias') desenharNoticias();
  if (pagina === 'graficos') desenharGraficos();
}

/* ============================================================
   TELA 1 — PREÇOS
   ============================================================ */
function montarFiltros() {
  $('#filtro-regiao').innerHTML = REGIOES.map(r =>
    `<button class="pilula ${r.id === estado.regiao ? 'ativa' : ''}" data-regiao="${r.id}">${r.nome}</button>`
  ).join('');

  $('#filtro-categoria').innerHTML = CATEGORIAS.map(c =>
    `<button class="pilula ${c.id === estado.categoria ? 'ativa' : ''}" data-categoria="${c.id}">${c.nome}</button>`
  ).join('');

  $('#filtro-regiao').onclick = e => {
    const b = e.target.closest('[data-regiao]'); if (!b) return;
    estado.regiao = b.dataset.regiao;
    estado.g.regiao = b.dataset.regiao;
    localStorage.setItem('bda_regiao', estado.regiao);
    $$('#filtro-regiao .pilula').forEach(p => p.classList.toggle('ativa', p.dataset.regiao === estado.regiao));
    montarSeletoresGraficos();
    desenharPrecos();
  };

  $('#filtro-categoria').onclick = e => {
    const b = e.target.closest('[data-categoria]'); if (!b) return;
    estado.categoria = b.dataset.categoria;
    $$('#filtro-categoria .pilula').forEach(p => p.classList.toggle('ativa', p.dataset.categoria === estado.categoria));
    desenharPrecos();
  };
}

function produtosVisiveis() {
  return PRODUTOS.filter(p =>
    D.precoDe(p.id, estado.regiao) &&
    (estado.categoria === 'todos' || p.categoria === estado.categoria));
}

function itensParaExportar() {
  return produtosVisiveis().map(p => {
    const info = D.precoDe(p.id, estado.regiao);
    return {
      produtoId: p.id,
      preco: info.preco,
      praca: info.praca,
      escopo: info.escopo,
      variacao: D.variacao(p.id, estado.regiao, 'dia')
    };
  });
}

function desenharCarregando() {
  $('#lista-precos').innerHTML =
    `<div class="carregando">${'<div class="esqueleto"></div>'.repeat(5)}</div>`;
}

function desenharMoedas() {
  const m = D.BANCO.moedas || {};
  const cartao = (chave, ic) => {
    const x = m[chave]; if (!x) return '';
    const d = x.variacao > 0.01 ? 'sobe' : x.variacao < -0.01 ? 'desce' : 'igual';
    return `<div class="moeda">
      <div class="simb">${icone(ic, 21)}</div>
      <div style="flex:1;min-width:0">
        <div class="nome">${x.nome}${x.aoVivo ? ' · ao vivo' : ''}</div>
        <div class="valor">${D.dinheiro(x.valor, 4)}</div>
      </div>
      <span class="variacao ${d}">${icone(d, 13)}${D.porcento(x.variacao)}</span>
    </div>`;
  };
  $('#moedas').innerHTML = cartao('USD', 'dolar') + cartao('EUR', 'euro');
}

function desenharPrecos() {
  const lista = produtosVisiveis();
  const regiao = REGIAO_POR_ID[estado.regiao];

  $('#sub-regiao').textContent = `${regiao.nome} — ${regiao.estados}`;

  if (!lista.length) {
    $('#lista-precos').innerHTML = vazio('lupa',
      'Nenhuma cotação por aqui.',
      `Não há ${estado.categoria === 'todos' ? 'produtos' : CATEGORIAS.find(c => c.id === estado.categoria).nome.toLowerCase()} cotados no ${regiao.nome}. Experimente outra categoria.`);
    return;
  }

  $('#lista-precos').innerHTML = `<div class="grade-precos">${lista.map((p, i) => {
    const info = D.precoDe(p.id, estado.regiao);
    const v = D.variacao(p.id, estado.regiao, 'dia');
    const casas = D.casasDe(p.id);
    const pontos = D.ultimos(p.id, estado.regiao, 15).map(x => x.valor);

    const direita = v
      ? `<span class="variacao ${v.direcao}">${icone(v.direcao, 13)}${D.porcento(v.pct)}</span>
         ${pontos.length >= 3 ? miniGrafico(pontos) : ''}`
      : `<span class="variacao igual" title="Primeiro dia de coleta: ainda não há pregão anterior para comparar">—</span>`;

    return `<button class="cartao" data-produto="${p.id}" data-cat="${p.categoria}" style="animation-delay:${Math.min(i * 32, 400)}ms">
      <span class="figura">${icone(p.icone, 25)}</span>
      <span class="meio">
        <span class="nome">${p.nome}</span>
        <span class="praca">${info.praca || regiao.nome}</span>
        <span class="preco">${D.dinheiro(info.preco, casas)} <span class="un">/${p.unidadeCurta}</span></span>
      </span>
      <span class="direita">${direita}</span>
    </button>`;
  }).join('')}</div>`;

  $('#lista-precos').onclick = e => {
    const b = e.target.closest('[data-produto]');
    if (b) abrirDetalhe(b.dataset.produto);
  };
}

function desenharAviso() {
  const caixa = $('#aviso-origem');
  const quando = D.BANCO.precos?.atualizado_em;
  const texto = quando
    ? new Date(quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
  const fs = D.fontes();

  caixa.className = 'aviso-dados aviso-ok';

  /* Nos primeiros dias a série ainda é curta. Melhor dizer isso do
     que deixar o produtor achando que o app está quebrado ao ver "—". */
  const inicio = PRODUTOS
    .map(p => D.inicioDaSerie(p.id, estado.regiao))
    .filter(Boolean)
    .sort()[0];

  const diasDeColeta = inicio
    ? Math.round((Date.now() - new Date(inicio + 'T12:00:00').getTime()) / 86400000)
    : 0;

  const recado = diasDeColeta < 30
    ? `<br>A coleta começou em <b>${D.dataLonga(inicio)}</b>. Períodos maiores
       (mês, ano) aparecem como <b>—</b> até haver histórico suficiente — vão se
       preenchendo sozinhos, um dia por vez.`
    : '';

  caixa.innerHTML = `${icone('relogio', 18)}<div>Atualizado em <b>${texto}</b>.
    ${fs.length ? 'Fonte: <b>' + fs.join(', ') + '</b>.' : ''}
    Valores de referência — confirme com seu comprador antes de negociar.${recado}</div>`;
}

function desenharTudo() {
  desenharAviso();
  desenharMoedas();
  desenharPrecos();
}

/* ------------------------------------------------------------
   Janela de detalhe
   ------------------------------------------------------------ */
function abrirDetalhe(produtoId) {
  const p = PRODUTO_POR_ID[produtoId];
  const info = D.precoDe(produtoId, estado.regiao);
  const casas = D.casasDe(produtoId);
  const escopo = D.escopoDe(produtoId, estado.regiao);

  const pontos = D.ultimos(produtoId, estado.regiao, 5);
  const vDia = D.variacao(produtoId, estado.regiao, 'dia');

  const periodos = ['dia', 'semana', 'mes', 'ano'].map(k => ({
    rotulo: D.PERIODOS[k].rotulo,
    v: D.cobrePeriodo(produtoId, estado.regiao, k) ? D.variacao(produtoId, estado.regiao, k) : null
  }));

  const inicio = D.inicioDaSerie(produtoId, estado.regiao);
  const total = D.tamanhoSerie(produtoId, estado.regiao);

  abrirJanela(`
    <div class="janela-topo">
      <span class="figura" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--verde-claro);color:var(--verde)">${icone(p.icone, 24)}</span>
      <div style="flex:1">
        <h3 style="font-size:18px">${p.nome}</h3>
        <div style="font-size:12.5px;color:var(--tinta-3)">por ${p.unidade} · ${REGIAO_POR_ID[estado.regiao].nome}</div>
      </div>
      <button class="btn-icone" data-fecha>${icone('fechar', 20)}</button>
    </div>

    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
      <span style="font-size:32px;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums">${D.dinheiro(info.preco, casas)}</span>
      ${vDia ? `<span class="variacao ${vDia.direcao}">${icone(vDia.direcao, 14)}${D.porcento(vDia.pct)}</span>` : ''}
    </div>

    <div style="font-size:12px;color:var(--verde);font-weight:600;margin-bottom:12px">
      ${icone('relogio', 13, 'em-linha')} Cotação de ${D.dataLonga(info.data)} · fonte ${info.fonte || 'CEPEA/ESALQ-USP'}
      ${vDia ? `<span style="color:var(--tinta-3);font-weight:400"> · comparado com ${D.dataLonga(vDia.de)}</span>` : ''}
    </div>

    ${escopo ? `<div style="display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.5;
        background:var(--papel);border:1px solid var(--linha);color:var(--tinta-2);
        padding:11px 13px;border-radius:10px;margin-bottom:16px">
      ${icone('precos', 16)}<div><b>${escopo.etiqueta}</b> — ${info.praca}.<br>${escopo.explica}</div>
    </div>` : ''}

    <div class="caixa-grafico">
      ${pontos.length >= 2
        ? graficoLinha({
            series: [{ nome: p.nome, valores: pontos.map(d => d.valor), cor: 'var(--verde)', casas }],
            datas: pontos.map(d => d.data),
            altura: 200
          })
        : ''}
    </div>
    ${pontos.length >= 2
      ? `<div id="dica-detalhe" style="font-size:12.5px;color:var(--tinta-3);text-align:center;min-height:20px;margin-top:6px">
           Últimos ${pontos.length} pregões · passe o dedo para ver cada dia
         </div>`
      : `<div style="font-size:12.5px;color:var(--tinta-3);text-align:center;padding:14px">
           Só temos a cotação de hoje ainda. O gráfico aparece a partir do segundo dia.
         </div>`}

    <div class="resumo-numeros">
      ${periodos.map(x => `<div class="num" ${x.v ? '' : 'title="A coleta ainda não cobre esse período"'}>
        <div class="r">${x.rotulo}</div>
        <div class="v" style="color:${x.v ? (x.v.direcao === 'sobe' ? 'var(--alta)' : x.v.direcao === 'desce' ? 'var(--baixa)' : 'var(--tinta)') : 'var(--tinta-3)'}">
          ${x.v ? D.porcento(x.v.pct) : '—'}
        </div>
      </div>`).join('')}
    </div>

    ${periodos.some(x => !x.v) ? `<div style="font-size:11.5px;color:var(--tinta-3);margin-top:8px;line-height:1.5">
      Os períodos com <b>—</b> ainda não têm histórico. Temos <b>${total} ${total === 1 ? 'cotação guardada' : 'cotações guardadas'}</b>,
      desde ${D.dataLonga(inicio)}. Cada dia de coleta preenche mais um pedaço.</div>` : ''}

    <button class="botao" style="margin-top:20px" data-ver-grafico="${produtoId}">
      ${icone('grafico', 19)} Ver gráfico completo
    </button>
  `, janela => {
    const svg = janela.querySelector('.grafico-linha');
    const dica = janela.querySelector('#dica-detalhe');
    if (svg && dica) {
      ativarGrafico(svg, ponto => {
        dica.textContent = ponto
          ? `${D.dataLonga(ponto.data)} — ${D.dinheiro(ponto.valores[0].valor, casas)}`
          : `Últimos ${pontos.length} pregões · passe o dedo para ver cada dia`;
      });
    }

    janela.querySelector('[data-ver-grafico]').onclick = () => {
      fecharJanela();
      estado.g.produtoA = produtoId;
      estado.g.regiao = estado.regiao;
      estado.g.produtoB = '';
      montarSeletoresGraficos();
      irPara('graficos');
    };
  });
}

/* ============================================================
   TELA 2 — NOTÍCIAS
   ============================================================ */
function dentroDoPeriodo(iso, periodo) {
  const q = new Date(iso).getTime();
  if (Number.isNaN(q)) return periodo === 'mes';
  const horas = (Date.now() - q) / 3600000;
  if (periodo === 'dia')    return horas <= 30;
  if (periodo === 'semana') return horas <= 24 * 7;
  return horas <= 24 * 31;
}

function desenharNoticias() {
  const todas = D.BANCO.noticias || [];
  const lista = todas.filter(n => dentroDoPeriodo(n.data, estado.periodoNoticias));

  $$('#filtro-noticias .pilula').forEach(p =>
    p.classList.toggle('ativa', p.dataset.periodo === estado.periodoNoticias));

  if (!todas.length) {
    $('#lista-noticias').innerHTML = vazio('jornal',
      'Ainda não há notícias aqui.',
      'As notícias chegam junto com a atualização automática diária.');
    return;
  }

  if (!lista.length) {
    const nomes = { dia: 'hoje', semana: 'nesta semana', mes: 'neste mês' };
    $('#lista-noticias').innerHTML = vazio('relogio',
      `Nada novo ${nomes[estado.periodoNoticias]}.`,
      'Experimente um período maior nos botões acima.');
    return;
  }

  $('#lista-noticias').innerHTML = `<div class="lista-noticias">${lista.map((n, i) => `
    <a class="noticia" href="${n.link}" target="_blank" rel="noopener noreferrer"
       style="animation-delay:${Math.min(i * 26, 400)}ms">
      <div class="topo">
        <span class="fonte">${escapar(n.fonte || 'Agro')}</span>
        <span class="quando">${D.tempoRelativo(n.data)}</span>
      </div>
      <h3>${escapar(n.titulo)}</h3>
      ${n.resumo ? `<p>${escapar(n.resumo).slice(0, 190)}${n.resumo.length > 190 ? '…' : ''}</p>` : ''}
    </a>`).join('')}</div>`;
}

/* ============================================================
   TELA 3 — GRÁFICOS E COMPARAÇÕES
   ============================================================ */
function montarSeletoresGraficos() {
  const comPreco = PRODUTOS.filter(p => D.precoDe(p.id, estado.g.regiao));

  if (comPreco.length && !comPreco.some(p => p.id === estado.g.produtoA)) estado.g.produtoA = comPreco[0].id;
  if (estado.g.produtoB && !comPreco.some(p => p.id === estado.g.produtoB)) estado.g.produtoB = '';

  const opcoes = (sel, vazioTexto) =>
    (vazioTexto ? `<option value="">${vazioTexto}</option>` : '') +
    comPreco.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.nome}</option>`).join('');

  $('#sel-produto-a').innerHTML = opcoes(estado.g.produtoA, null);
  $('#sel-produto-b').innerHTML = opcoes(estado.g.produtoB, '— nenhum —');
  $('#sel-regiao-g').innerHTML = REGIOES.map(r =>
    `<option value="${r.id}" ${r.id === estado.g.regiao ? 'selected' : ''}>${r.nome}</option>`).join('');
}

function desenharGraficos() {
  const { produtoA, produtoB, regiao, periodo } = estado.g;
  const pA = PRODUTO_POR_ID[produtoA];
  const pB = produtoB ? PRODUTO_POR_ID[produtoB] : null;

  $$('#filtro-periodo .pilula').forEach(b =>
    b.classList.toggle('ativa', b.dataset.periodo === periodo));

  const serieA = D.pontosDoPeriodo(produtoA, regiao, periodo);
  const serieB = pB ? D.pontosDoPeriodo(produtoB, regiao, periodo) : [];

  if (serieA.length < 2) {
    $('#area-graficos').innerHTML = `<div class="painel">
      <div class="painel-topo"><div>
        <h3>${pA.nome}</h3>
        <div class="sub">${REGIAO_POR_ID[regiao].nome}</div>
      </div></div>
      ${vazio('grafico', 'Histórico ainda muito curto.',
        `Temos ${D.tamanhoSerie(produtoA, regiao)} cotação guardada deste produto.
         O gráfico começa a desenhar a partir de duas — ou seja, amanhã.`)}
    </div>`;
    return;
  }

  const comparando = !!pB && serieB.length >= 2;
  const base100 = comparando && estado.g.base100;

  const series = [{
    nome: pA.nome, valores: serieA.map(d => d.valor),
    cor: 'var(--verde)', casas: D.casasDe(produtoA)
  }];
  if (comparando) series.push({
    nome: pB.nome, valores: serieB.map(d => d.valor),
    cor: 'var(--ambar)', casas: D.casasDe(produtoB)
  });

  const rA = extremos(serieA);
  const rB = comparando ? extremos(serieB) : null;

  /* Variação por região — só onde a série cobre o período */
  const barras = D.regioesDe(produtoA)
    .map(r => ({ r, v: D.cobrePeriodo(produtoA, r, periodo) ? D.variacao(produtoA, r, periodo) : null }))
    .filter(x => x.v)
    .map(x => ({ rotulo: REGIAO_POR_ID[x.r]?.curto || x.r, valor: x.v.pct, rotuloValor: D.porcento(x.v.pct) }));

  const cobre = D.cobrePeriodo(produtoA, regiao, periodo);

  $('#area-graficos').innerHTML = `
    <div class="painel">
      <div class="painel-topo">
        <div style="flex:1">
          <h3>${pA.nome}${comparando ? ` <span style="color:var(--tinta-3);font-weight:400">vs</span> ${pB.nome}` : ''}</h3>
          <div class="sub">${REGIAO_POR_ID[regiao].nome} · ${D.dataLonga(serieA[0].data)} a ${D.dataLonga(serieA[serieA.length - 1].data)} · ${serieA.length} pregões</div>
        </div>
        ${comparando ? `<button class="pilula ${base100 ? 'ativa' : ''}" id="btn-base100"
          title="Coloca os dois no mesmo ponto de partida para ver quem subiu mais">
          ${icone('trocar', 15)} Comparar em %
        </button>` : ''}
      </div>

      ${!cobre ? `<div style="display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.5;
          background:var(--ambar-claro);color:var(--terra);padding:9px 11px;border-radius:9px;margin-bottom:12px">
        ${icone('aviso', 15)}<div>A coleta começou em <b>${D.dataLonga(D.inicioDaSerie(produtoA, regiao))}</b>,
        então ainda não há ${D.PERIODOS[periodo].rotulo.toLowerCase()} inteiro. O gráfico mostra tudo o que existe até agora.</div>
      </div>` : ''}

      <div class="caixa-grafico">
        ${graficoLinha({ series, datas: serieA.map(d => d.data), altura: 270, base100 })}
      </div>

      <div id="leitura" style="text-align:center;font-size:13px;color:var(--tinta-3);min-height:22px;margin-top:8px">
        Passe o dedo (ou o mouse) sobre o gráfico para ver os valores de cada dia
      </div>

      <div class="legenda">
        ${series.map(s => `<span><i style="background:${s.cor}"></i>${s.nome}</span>`).join('')}
      </div>

      <div class="resumo-numeros">
        <div class="num"><div class="r">Preço hoje</div><div class="v">${D.dinheiro(serieA[serieA.length - 1].valor, D.casasDe(produtoA))}</div></div>
        <div class="num"><div class="r">Menor</div><div class="v">${D.dinheiro(rA.min, D.casasDe(produtoA))}</div></div>
        <div class="num"><div class="r">Maior</div><div class="v">${D.dinheiro(rA.max, D.casasDe(produtoA))}</div></div>
        <div class="num"><div class="r">No período</div>
          <div class="v" style="color:${rA.pct >= 0 ? 'var(--alta)' : 'var(--baixa)'}">${D.porcento(rA.pct)}</div></div>
      </div>

      ${comparando ? `<div class="resumo-numeros" style="margin-top:8px">
        <div class="num" style="border-color:color-mix(in srgb, var(--ambar) 40%, transparent)">
          <div class="r">${pB.nome} hoje</div><div class="v">${D.dinheiro(serieB[serieB.length - 1].valor, D.casasDe(produtoB))}</div></div>
        <div class="num" style="border-color:color-mix(in srgb, var(--ambar) 40%, transparent)">
          <div class="r">${pB.nome} no período</div>
          <div class="v" style="color:${rB.pct >= 0 ? 'var(--alta)' : 'var(--baixa)'}">${D.porcento(rB.pct)}</div></div>
        <div class="num" style="border-color:color-mix(in srgb, var(--verde) 40%, transparent)">
          <div class="r">Quem subiu mais</div>
          <div class="v">${rA.pct === rB.pct ? 'Empate' : (rA.pct > rB.pct ? pA.nome : pB.nome)}</div></div>
      </div>` : ''}
    </div>

    ${barras.length >= 2 ? `<div class="painel">
      <div class="painel-topo"><div>
        <h3>${pA.nome} — variação por estado</h3>
        <div class="sub">Quanto mudou ${rotuloPeriodo(periodo)}</div>
      </div></div>
      <div class="caixa-grafico">${graficoBarras(barras)}</div>
    </div>` : ''}`;

  const svg = $('#area-graficos .grafico-linha');
  const leitura = $('#leitura');
  ativarGrafico(svg, ponto => {
    leitura.innerHTML = ponto
      ? `<b>${D.dataLonga(ponto.data)}</b> &nbsp; ` + ponto.valores.map(v =>
          `<span style="color:${v.cor};font-weight:700">${v.nome}: ${D.dinheiro(v.valor, v.casas)}</span>`).join(' &nbsp;·&nbsp; ')
      : 'Passe o dedo (ou o mouse) sobre o gráfico para ver os valores de cada dia';
  });

  const btn100 = $('#btn-base100');
  if (btn100) btn100.onclick = () => { estado.g.base100 = !estado.g.base100; desenharGraficos(); };
}

function extremos(serie) {
  const vals = serie.map(d => d.valor);
  const ini = vals[0], fim = vals[vals.length - 1];
  return { min: Math.min(...vals), max: Math.max(...vals), pct: ini ? ((fim - ini) / ini) * 100 : 0 };
}

function rotuloPeriodo(p) {
  return { dia: 'nos últimos pregões', semana: 'na semana', mes: 'no mês', trimestre: 'no trimestre', ano: 'no ano' }[p] || '';
}

/* ============================================================
   EXPORTAR
   ============================================================ */
function abrirExportar() {
  const regiao = REGIAO_POR_ID[estado.regiao];
  const quantos = produtosVisiveis().length;
  if (!quantos) { avisar('Não há preços na tela para exportar.'); return; }

  abrirJanela(`
    <div class="janela-topo">
      <span class="figura" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--verde-claro);color:var(--verde)">${icone('exportar', 24)}</span>
      <div style="flex:1">
        <h3>Compartilhar preços</h3>
        <div style="font-size:12.5px;color:var(--tinta-3)">${quantos} produtos · ${regiao.nome}</div>
      </div>
      <button class="btn-icone" data-fecha>${icone('fechar', 20)}</button>
    </div>

    <button class="opcao-export" data-acao="imagem">
      <span class="figura">${icone('imagem', 22)}</span>
      <span><span class="t">Imagem para o grupo</span>
      <span class="d">Um card bonito, prontinho para mandar no WhatsApp</span></span>
    </button>

    <button class="opcao-export" data-acao="whatsapp">
      <span class="figura">${icone('whatsapp', 22)}</span>
      <span><span class="t">Abrir no WhatsApp</span>
      <span class="d">Manda a lista em texto, já formatada</span></span>
    </button>

    <button class="opcao-export" data-acao="pdf">
      <span class="figura">${icone('pdf', 22)}</span>
      <span><span class="t">Salvar em PDF</span>
      <span class="d">Abre a impressão — escolha "Salvar como PDF"</span></span>
    </button>

    <button class="opcao-export" data-acao="copiar">
      <span class="figura">${icone('jornal', 22)}</span>
      <span><span class="t">Copiar o texto</span>
      <span class="d">Cola onde quiser depois</span></span>
    </button>
  `, janela => {
    janela.onclick = async e => {
      const b = e.target.closest('[data-acao]'); if (!b) return;
      const itens = itensParaExportar();
      const escuro = document.documentElement.getAttribute('data-tema') === 'escuro';

      if (b.dataset.acao === 'whatsapp') { fecharJanela(); Exportar.abrirWhatsApp(itens, estado.regiao); }

      if (b.dataset.acao === 'pdf') { fecharJanela(); setTimeout(() => Exportar.gerarPDF(itens, estado.regiao), 220); }

      if (b.dataset.acao === 'copiar') {
        const ok = await Exportar.copiarTexto(itens, estado.regiao);
        fecharJanela();
        avisar(ok ? 'Texto copiado! É só colar no WhatsApp.' : 'Não consegui copiar. Tente a opção do WhatsApp.');
      }

      if (b.dataset.acao === 'imagem') {
        b.querySelector('.t').textContent = 'Preparando a imagem…';
        const r = await Exportar.gerarImagem(itens, estado.regiao, escuro);
        fecharJanela();
        if (r === 'baixado') avisar('Imagem salva na pasta de downloads. Agora é só mandar no grupo!');
        if (r === 'compartilhado') avisar('Enviado!');
      }
    };
  });
}

/* ============================================================
   PEÇAS REUTILIZÁVEIS
   ============================================================ */
function abrirJanela(html, depois) {
  fecharJanela();
  const fundo = document.createElement('div');
  fundo.className = 'fundo-janela';
  fundo.innerHTML = `<div class="janela" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(fundo);
  document.body.style.overflow = 'hidden';

  fundo.addEventListener('click', e => {
    if (e.target === fundo || e.target.closest('[data-fecha]')) fecharJanela();
  });
  if (depois) depois(fundo.querySelector('.janela'));
}

function fecharJanela() {
  $('.fundo-janela')?.remove();
  document.body.style.overflow = '';
}

function avisar(texto) {
  $('#torradinha')?.remove();
  const t = document.createElement('div');
  t.id = 'torradinha';
  t.textContent = texto;
  t.style.cssText = `position:fixed;left:50%;bottom:100px;transform:translateX(-50%);
    background:var(--tinta);color:var(--papel);padding:13px 20px;border-radius:999px;
    font-size:14px;font-weight:600;z-index:400;box-shadow:var(--sombra-alta);
    max-width:calc(100vw - 36px);text-align:center;animation:sobe .3s both`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 3200);
  setTimeout(() => t.remove(), 3700);
}

function vazio(ic, titulo, texto) {
  return `<div class="vazio">${icone(ic, 40)}
    <div style="font-size:16px;font-weight:700;color:var(--tinta-2);margin-bottom:5px">${titulo}</div>
    <div style="font-size:13.5px;max-width:360px;margin:0 auto;line-height:1.6">${texto}</div></div>`;
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

/** Em que faixa de largura a tela está (celular / tablet / PC) */
function faixaDaTela() {
  const l = window.innerWidth;
  return l < 480 ? 'p' : l < 760 ? 'm' : 'g';
}

/* ============================================================
   LIGAR TUDO
   ============================================================ */
function iniciar() {
  aplicarTema(localStorage.getItem('bda_tema') || 'claro');
  pintarFaixa();
  setInterval(pintarFaixa, 60000);

  $('#ano-atual').textContent = new Date().getFullYear();
  $$('.btn-tema').forEach(b => b.onclick = alternarTema);
  $$('[data-aba]').forEach(b => b.onclick = () => irPara(b.dataset.aba));

  $('#btn-sair').onclick = () => { Auth.sair(); location.reload(); };

  $('#btn-exportar-flutuante').onclick = abrirExportar;
  $('#btn-exportar-topo').onclick = abrirExportar;

  $('#filtro-noticias').onclick = e => {
    const b = e.target.closest('[data-periodo]'); if (!b) return;
    estado.periodoNoticias = b.dataset.periodo;
    desenharNoticias();
  };

  $('#filtro-periodo').onclick = e => {
    const b = e.target.closest('[data-periodo]'); if (!b) return;
    estado.g.periodo = b.dataset.periodo;
    desenharGraficos();
  };

  $('#sel-produto-a').onchange = e => { estado.g.produtoA = e.target.value; desenharGraficos(); };
  $('#sel-produto-b').onchange = e => { estado.g.produtoB = e.target.value; desenharGraficos(); };
  $('#sel-regiao-g').onchange  = e => {
    estado.g.regiao = e.target.value;
    montarSeletoresGraficos();
    desenharGraficos();
  };

  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharJanela(); });

  /* Girou o celular ou redimensionou a janela? Os gráficos precisam
     ser redesenhados na proporção certa. */
  let faixaTela = faixaDaTela();
  let espera;
  window.addEventListener('resize', () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const nova = faixaDaTela();
      if (nova === faixaTela || !estado.usuario) return;
      faixaTela = nova;
      if (estado.pagina === 'graficos') desenharGraficos();
      if (estado.pagina === 'precos') desenharPrecos();
    }, 250);
  });

  montarLogin();

  if (Auth.faltaConfigurarNuvem()) {
    $('#aviso-modo-login').innerHTML = `<div class="recado info" style="margin-top:14px">
      ${icone('aviso', 16)}<span><b>Modo de teste.</b> O login na nuvem ainda não foi
      configurado, então o cadastro fica salvo só neste aparelho.
      Preencha a URL e a chave do Supabase em <b>js/config.js</b>.</span></div>`;
  }

  const salvo = Auth.usuarioAtual();
  if (salvo) abrirApp(salvo);
  else $('#tela-login').classList.remove('oculto');
}

document.addEventListener('DOMContentLoaded', iniciar);
