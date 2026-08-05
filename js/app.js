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
  regiao: localStorage.getItem('bda_regiao') || 'centro-oeste',
  categoria: 'todos',
  periodoNoticias: 'dia',
  // tela de gráficos
  g: {
    produtoA: 'boi-gordo',
    produtoB: '',
    regiao: localStorage.getItem('bda_regiao') || 'centro-oeste',
    periodo: 'mes',
    base100: false
  }
};

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
  const atual = document.documentElement.getAttribute('data-tema');
  aplicarTema(atual === 'escuro' ? 'claro' : 'escuro');
}

/* ============================================================
   A FAIXA DO AMANHECER
   Muda de âmbar para verde conforme a hora do dia.
   ============================================================ */
function pintarFaixa() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  // 5h da manhã = amanhecer puro (âmbar) · meio-dia = verde pleno
  // fim da tarde volta ao âmbar, noite fica no verde escuro
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
  const l = $('#login-form');

  $('#link-trocar').onclick = () => {
    modoCadastro = !modoCadastro;
    $('#campo-nome').classList.toggle('oculto', !modoCadastro);
    // o campo de convite só aparece no cadastro, e só se houver código configurado
    $('#campo-convite').classList.toggle('oculto', !(modoCadastro && Auth.exigeConvite()));
    $('#btn-entrar').textContent = modoCadastro ? 'Criar minha conta' : 'Entrar';
    $('#link-trocar').textContent = modoCadastro
      ? 'Já tenho conta — quero entrar'
      : 'Ainda não tenho conta — quero me cadastrar';
    $('#titulo-login').textContent = modoCadastro ? 'Criar conta' : 'Entrar';
    recado('');
    if (modoCadastro) $('#nome').focus(); else $('#email').focus();
  };

  l.onsubmit = async e => {
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
  if (!texto) { c.innerHTML = ''; return; }
  c.innerHTML = `<div class="recado ${tipo}">${icone(tipo === 'ok' ? 'sol' : 'aviso', 16)}<span>${texto}</span></div>`;
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
  } catch (e) {
    $('#lista-precos').innerHTML = vazio('aviso',
      'Não consegui carregar os preços.',
      'Verifique sua internet e recarregue a página.');
    return;
  }
  // só agora dá para montar os menus: eles dependem dos dados carregados
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

/** Os produtos que aparecem agora (região + categoria escolhidas) */
function produtosVisiveis() {
  return PRODUTOS.filter(p => {
    const temPreco = D.precoDe(p.id, estado.regiao);
    const daCategoria = estado.categoria === 'todos' || p.categoria === estado.categoria;
    return temPreco && daCategoria;
  });
}

function itensParaExportar() {
  return produtosVisiveis().map(p => {
    const info = D.precoDe(p.id, estado.regiao);
    return {
      produtoId: p.id,
      preco: info.preco,
      praca: info.praca,
      real: D.precoEhReal(p.id, estado.regiao),
      variacao: D.variacaoConfiavel(p.id, estado.regiao, 'dia')
    };
  });
}

function desenharCarregando() {
  $('#lista-precos').innerHTML =
    `<div class="carregando">${'<div class="esqueleto"></div>'.repeat(6)}</div>`;
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
      `Não temos ${estado.categoria === 'todos' ? 'produtos' : CATEGORIAS.find(c => c.id === estado.categoria).nome.toLowerCase()} cotados no ${regiao.nome}. Experimente outra região ou categoria.`);
    return;
  }

  $('#lista-precos').innerHTML = `<div class="grade-precos">${lista.map((p, i) => {
    const info = D.precoDe(p.id, estado.regiao);
    const real = D.precoEhReal(p.id, estado.regiao);
    const v = D.variacaoConfiavel(p.id, estado.regiao, 'dia');
    const casas = D.casasDe(p.id);

    /* Só mostra variação e linha quando existe histórico real.
       Sem isso o cartão estamparia um número inventado com cara
       de informação — fica só a etiqueta "exemplo" ou um traço. */
    const direita = v
      ? `<span class="variacao ${v.direcao}">${icone(v.direcao, 13)}${D.porcento(v.pct)}</span>
         ${miniGrafico(D.ultimos(p.id, estado.regiao, 15).map(x => x.valor))}`
      : `<span class="variacao igual" title="${real
            ? 'A coleta diária começou agora: ainda não há dois dias reais para comparar'
            : 'Sem fonte real: não há variação para informar'}">—</span>`;

    return `<button class="cartao" data-produto="${p.id}" data-cat="${p.categoria}" style="animation-delay:${Math.min(i * 28, 400)}ms">
      <span class="figura">${icone(p.icone, 25)}</span>
      <span class="meio">
        <span class="nome">${p.nome}${real ? '' : '<span class="etiqueta-exemplo">exemplo</span>'}</span>
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
  const c = D.contagem();
  const fontes = D.BANCO.precos?.fontes?.length ? D.BANCO.precos.fontes.join(', ') : null;

  caixa.className = 'aviso-dados';
  caixa.removeAttribute('style');

  if (D.tudoExemplo()) {
    caixa.innerHTML = `${icone('aviso', 18)}<div><b>Tudo aqui é demonstração.</b>
      Estes números são simulados, só para você ver o app funcionando.
      Ligue a atualização automática (está explicado no LEIA-ME) para receber
      as cotações reais do CEPEA todo dia de manhã.</div>`;
    return;
  }

  /* Primeiros dias: já temos preço real, mas ainda não temos dois dias
     reais para comparar. Melhor explicar do que deixar o produtor
     achando que o app quebrou ao ver "—" em tudo. */
  const semVariacaoAinda = c.reais > 0 && !PRODUTOS.some(p =>
    D.variacaoConfiavel(p.id, estado.regiao, 'dia'));

  const recado = semVariacaoAinda
    ? `<br>A coleta diária começou agora, então as variações aparecem como <b>—</b>.
       <b>Amanhã</b> você já vê quanto subiu ou caiu de um dia para o outro;
       em uma semana, a da semana; em um mês, a do mês.`
    : '';

  if (c.exemplo > 0) {
    caixa.innerHTML = `${icone('aviso', 18)}<div>
      <b>${c.reais} de ${c.total} cotações são reais</b> (${fontes || 'fonte pública'}), atualizadas em ${texto}.
      As demais aparecem marcadas com a etiqueta <b>exemplo</b> — são simuladas
      porque ainda não há fonte pública gratuita configurada para elas.${recado}</div>`;
    return;
  }

  caixa.classList.add('aviso-ok');
  caixa.innerHTML = `${icone('relogio', 18)}<div>Atualizado em <b>${texto}</b>.
    ${fontes ? 'Fonte: ' + fontes + '.' : ''}
    Valores de referência — confirme com seu comprador antes de negociar.${recado}</div>`;
}

function desenharTudo() {
  desenharAviso();
  desenharMoedas();
  desenharPrecos();
}

/* ------------------------------------------------------------
   Janela de detalhe: gráfico dos últimos 5 dias + comparações
   ------------------------------------------------------------ */
function abrirDetalhe(produtoId) {
  const p = PRODUTO_POR_ID[produtoId];
  const info = D.precoDe(produtoId, estado.regiao);
  const casas = D.casasDe(produtoId);
  const dados5 = D.ultimos(produtoId, estado.regiao, 5);

  const real = D.precoEhReal(produtoId, estado.regiao);
  const periodos = ['dia', 'semana', 'mes', 'ano'].map(k => ({
    rotulo: D.PERIODOS[k].rotulo,
    v: D.variacaoConfiavel(produtoId, estado.regiao, k)
  }));

  /* Como está o preço nas outras regiões.
     Quando a fonte publica um indicador ÚNICO para o Brasil, não faz
     sentido listar cinco regiões com o mesmo número — em vez disso o
     app explica que aquele preço é uma referência nacional. */
  const outras = (info.nacional || !real) ? [] : D.regioesDe(produtoId)
    .filter(r => r !== estado.regiao && D.precoEhReal(produtoId, r))   // só compara preço real com preço real
    .map(r => ({ regiao: REGIAO_POR_ID[r], info: D.precoDe(produtoId, r) }))
    .filter(o => o.info && o.info.preco !== info.preco);

  abrirJanela(`
    <div class="janela-topo">
      <span class="figura" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--verde-claro);color:var(--verde)">${icone(p.icone, 24)}</span>
      <div style="flex:1">
        <h3 style="font-size:18px">${p.nome}</h3>
        <div style="font-size:12.5px;color:var(--tinta-3)">${info.praca || ''} · por ${p.unidade}</div>
      </div>
      <button class="btn-icone" data-fecha>${icone('fechar', 20)}</button>
    </div>

    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
      <span style="font-size:32px;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums">${D.dinheiro(info.preco, casas)}</span>
      ${periodos[0].v ? `<span class="variacao ${periodos[0].v.direcao}">${icone(periodos[0].v.direcao, 14)}${D.porcento(periodos[0].v.pct)}</span>` : ''}
    </div>
    <div style="font-size:12.5px;color:var(--tinta-3);margin-bottom:6px">
      Últimos 5 pregões · ${REGIAO_POR_ID[estado.regiao].nome}
    </div>
    ${real
      ? `<div style="font-size:12px;color:var(--verde);font-weight:600;margin-bottom:14px">
           ${icone('relogio', 13, 'em-linha')} Cotação real — fonte ${info.fonte || 'CEPEA/ESALQ-USP'}${info.data ? ' · ' + D.dataLonga(info.data) : ''}
         </div>`
      : `<div style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.5;
             background:var(--ambar-claro);color:var(--terra);padding:10px 12px;border-radius:9px;margin-bottom:14px">
           ${icone('aviso', 15)}<div><b>Valor simulado.</b> Este produto ainda não tem fonte pública
           gratuita configurada, então o número e o gráfico abaixo são só demonstração de como a tela
           funciona. Não use para negociar.</div>
         </div>`}

    ${notaHistorico(produtoId, estado.regiao, 5)}

    <div class="caixa-grafico" id="grafico-detalhe">
      ${graficoLinha({
        series: [{
          nome: p.nome, valores: dados5.map(d => d.valor), cor: 'var(--verde)', casas,
          reais: real ? D.pregoesReais(produtoId, estado.regiao) : 0
        }],
        datas: dados5.map(d => d.data),
        altura: 200
      })}
    </div>
    <div id="dica-detalhe" style="font-size:12.5px;color:var(--tinta-3);text-align:center;min-height:20px;margin-top:6px">
      Passe o dedo no gráfico para ver o preço de cada dia
    </div>

    <div class="resumo-numeros">
      ${periodos.map(x => `<div class="num" ${x.v ? '' : 'title="Ainda não há histórico real cobrindo esse período"'}>
        <div class="r">${x.rotulo}</div>
        <div class="v" style="color:${x.v ? (x.v.direcao === 'sobe' ? 'var(--alta)' : x.v.direcao === 'desce' ? 'var(--baixa)' : 'var(--tinta)') : 'var(--tinta-3)'}">
          ${x.v ? D.porcento(x.v.pct) : '—'}
        </div>
      </div>`).join('')}
    </div>
    ${periodos.some(x => !x.v) && real ? `<div style="font-size:11.5px;color:var(--tinta-3);margin-top:7px;line-height:1.5">
      Os períodos com <b>—</b> aparecem assim porque a coleta diária real ainda não cobre esse tempo.
      Cada dia que passa preenche mais um pedaço.</div>` : ''}

    ${info.nacional ? `
      <div style="display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.5;
          background:var(--papel);border:1px solid var(--linha);color:var(--tinta-2);
          padding:11px 13px;border-radius:10px;margin-top:18px">
        ${icone('precos', 16)}<div>Este produto tem <b>um indicador único para o Brasil inteiro</b>.
        Vale como referência em qualquer região — o preço na sua praça varia conforme frete,
        prazo e negociação.</div>
      </div>` : ''}

    ${outras.length ? `
      <div class="titulo-secao" style="margin-top:22px">Nas outras regiões<span class="linha"></span></div>
      <div style="display:grid;gap:7px">
        ${outras.map(o => {
          const dif = o.info.preco - info.preco;
          const pct = info.preco ? (dif / info.preco) * 100 : 0;
          const d = Math.abs(pct) < 0.05 ? 'igual' : pct > 0 ? 'sobe' : 'desce';
          return `<div style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:var(--papel);border:1px solid var(--linha);border-radius:10px">
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700">${o.regiao.nome}</div>
              <div style="font-size:11.5px;color:var(--tinta-3)">${o.info.praca || ''}</div>
            </div>
            <div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums">${D.dinheiro(o.info.preco, casas)}</div>
            <span class="variacao ${d}" style="font-size:11.5px">${D.porcento(pct)}</span>
          </div>`;
        }).join('')}
      </div>` : ''}

    <button class="botao" style="margin-top:20px" data-ver-grafico="${produtoId}">
      ${icone('grafico', 19)} Ver gráfico completo
    </button>
  `, janela => {
    const svg = janela.querySelector('.grafico-linha');
    const dica = janela.querySelector('#dica-detalhe');
    ativarGrafico(svg, ponto => {
      dica.textContent = ponto
        ? `${D.dataLonga(ponto.data)} — ${D.dinheiro(ponto.valores[0].valor, casas)}`
        : 'Passe o dedo no gráfico para ver o preço de cada dia';
    });

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
      'As notícias chegam junto com a atualização automática diária. Veja o LEIA-ME para ligar essa parte.');
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
  const opcoes = (sel, vazioTexto) =>
    (vazioTexto ? `<option value="">${vazioTexto}</option>` : '') +
    comPreco.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.nome}</option>`).join('');

  if (comPreco.length && !comPreco.some(p => p.id === estado.g.produtoA)) {
    estado.g.produtoA = comPreco[0].id;
  }
  if (estado.g.produtoB && !comPreco.some(p => p.id === estado.g.produtoB)) {
    estado.g.produtoB = '';
  }

  $('#sel-produto-a').innerHTML = opcoes(estado.g.produtoA, null);
  $('#sel-produto-b').innerHTML = opcoes(estado.g.produtoB, '— nenhum —');
  $('#sel-regiao-g').innerHTML = REGIOES.map(r =>
    `<option value="${r.id}" ${r.id === estado.g.regiao ? 'selected' : ''}>${r.nome}</option>`).join('');
}

function desenharGraficos() {
  const { produtoA, produtoB, regiao, periodo } = estado.g;
  const pA = PRODUTO_POR_ID[produtoA];
  const pB = produtoB ? PRODUTO_POR_ID[produtoB] : null;
  const pregoes = D.PERIODOS[periodo].pregoes;

  $$('#filtro-periodo .pilula').forEach(b =>
    b.classList.toggle('ativa', b.dataset.periodo === periodo));

  const serieA = D.ultimos(produtoA, regiao, pregoes);
  const serieB = pB ? D.ultimos(produtoB, regiao, pregoes) : [];

  if (!serieA.length) {
    $('#area-graficos').innerHTML = vazio('grafico',
      'Sem histórico para essa combinação.',
      'Escolha outro produto ou outra região.');
    return;
  }

  // Comparar dois produtos de preços muito diferentes? Usa base 100.
  const comparando = !!pB && serieB.length > 1;
  const base100 = comparando && estado.g.base100;

  const series = [{
    nome: pA.nome, valores: serieA.map(d => d.valor),
    cor: 'var(--verde)', casas: D.casasDe(produtoA), sufixo: '/' + pA.unidadeCurta,
    reais: D.precoEhReal(produtoA, regiao) ? D.pregoesReais(produtoA, regiao) : 0
  }];
  if (comparando) series.push({
    nome: pB.nome, valores: serieB.map(d => d.valor),
    cor: 'var(--ambar)', casas: D.casasDe(produtoB), sufixo: '/' + pB.unidadeCurta,
    reais: D.precoEhReal(produtoB, regiao) ? D.pregoesReais(produtoB, regiao) : 0
  });

  /* A janela do gráfico só é "confiável" quando a coleta real cobre
     todos os pontos. Antes disso os extremos e o % do período saem de
     curva estimada — então aparecem como "—" em vez de virar número. */
  const confiavelA = D.pregoesReais(produtoA, regiao) >= serieA.length;
  const confiavelB = comparando && D.pregoesReais(produtoB, regiao) >= serieB.length;

  const vA = variacaoNoPeriodo(serieA);
  const vB = comparando ? variacaoNoPeriodo(serieB) : null;
  const mostra = (ok, texto) => ok ? texto : '—';

  // Variação do produto A em cada região — só onde há histórico real
  const barras = D.regioesDe(produtoA)
    .map(r => ({ r, v: D.variacaoConfiavel(produtoA, r, periodo) }))
    .filter(x => x.v)
    .map(x => ({
      rotulo: REGIAO_POR_ID[x.r].curto,
      valor: x.v.pct,
      rotuloValor: D.porcento(x.v.pct)
    }));

  $('#area-graficos').innerHTML = `
    <div class="painel">
      <div class="painel-topo">
        <div style="flex:1">
          <h3>${pA.nome}${comparando ? ` <span style="color:var(--tinta-3);font-weight:400">vs</span> ${pB.nome}` : ''}</h3>
          <div class="sub">${REGIAO_POR_ID[regiao].nome} · ${D.dataLonga(serieA[0].data)} a ${D.dataLonga(serieA[serieA.length - 1].data)}</div>
        </div>
        ${comparando ? `<button class="pilula ${base100 ? 'ativa' : ''}" id="btn-base100" title="Coloca os dois no mesmo ponto de partida (100) para comparar quem subiu mais">
          ${icone('trocar', 15)} Comparar em %
        </button>` : ''}
      </div>

      ${notaHistorico(produtoA, regiao, serieA.length)}
      ${comparando ? notaHistorico(produtoB, regiao, serieB.length) : ''}

      <div class="caixa-grafico">
        ${graficoLinha({
          series, datas: serieA.map(d => d.data), altura: 270, base100
        })}
      </div>

      <div id="leitura" style="text-align:center;font-size:13px;color:var(--tinta-3);min-height:22px;margin-top:8px">
        Passe o dedo (ou o mouse) sobre o gráfico para ver os valores de cada dia
      </div>

      <div class="legenda">
        ${series.map(s => `<span><i style="background:${s.cor}"></i>${s.nome}</span>`).join('')}
      </div>

      <div class="resumo-numeros">
        <div class="num"><div class="r">Preço hoje</div><div class="v">${D.dinheiro(serieA[serieA.length - 1].valor, D.casasDe(produtoA))}</div></div>
        <div class="num"><div class="r">Menor</div><div class="v">${mostra(confiavelA, D.dinheiro(vA.min, D.casasDe(produtoA)))}</div></div>
        <div class="num"><div class="r">Maior</div><div class="v">${mostra(confiavelA, D.dinheiro(vA.max, D.casasDe(produtoA)))}</div></div>
        <div class="num"><div class="r">No período</div>
          <div class="v" style="color:${!confiavelA ? 'var(--tinta-3)' : vA.pct >= 0 ? 'var(--alta)' : 'var(--baixa)'}">${mostra(confiavelA, D.porcento(vA.pct))}</div></div>
      </div>

      ${comparando ? `<div class="resumo-numeros" style="margin-top:8px">
        <div class="num" style="border-color:color-mix(in srgb, var(--ambar) 40%, transparent)">
          <div class="r">${pB.nome} hoje</div><div class="v">${D.dinheiro(serieB[serieB.length - 1].valor, D.casasDe(produtoB))}</div></div>
        <div class="num" style="border-color:color-mix(in srgb, var(--ambar) 40%, transparent)">
          <div class="r">${pB.nome} no período</div>
          <div class="v" style="color:${!confiavelB ? 'var(--tinta-3)' : vB.pct >= 0 ? 'var(--alta)' : 'var(--baixa)'}">${mostra(confiavelB, D.porcento(vB.pct))}</div></div>
        <div class="num" style="border-color:color-mix(in srgb, var(--verde) 40%, transparent)">
          <div class="r">Quem subiu mais</div>
          <div class="v">${(confiavelA && confiavelB)
            ? (vA.pct === vB.pct ? 'Empate' : (vA.pct > vB.pct ? pA.nome : pB.nome))
            : '—'}</div></div>
      </div>` : ''}

      ${(!confiavelA || (comparando && !confiavelB)) ? `<div style="font-size:11.5px;color:var(--tinta-3);margin-top:9px;line-height:1.5">
        Os campos com <b>—</b> dependem de histórico real cobrindo todo o período escolhido.
        Como a coleta diária começou há pouco, eles vão se preencher sozinhos com o passar dos dias.</div>` : ''}
    </div>

    <div class="painel">
      <div class="painel-topo"><div>
        <h3>${pA.nome} — variação por região</h3>
        <div class="sub">Quanto mudou ${rotuloPeriodo(periodo)} em cada canto do Brasil</div>
      </div></div>
      ${barras.length
        ? `<div class="caixa-grafico">${graficoBarras(barras)}</div>`
        : vazio('relogio', 'Ainda sem histórico real para este período.',
            'A coleta diária começou há pouco. Assim que houver dias reais suficientes, o comparativo entre regiões aparece aqui.')}
    </div>`;

  const svg = $('#area-graficos .grafico-linha');
  const leitura = $('#leitura');
  ativarGrafico(svg, ponto => {
    if (!ponto) {
      leitura.textContent = 'Passe o dedo (ou o mouse) sobre o gráfico para ver os valores de cada dia';
      return;
    }
    leitura.innerHTML = `<b>${D.dataLonga(ponto.data)}</b> &nbsp; ` + ponto.valores.map(v =>
      `<span style="color:${v.cor};font-weight:700">${v.nome}: ${D.dinheiro(v.valor, v.casas)}</span>`
    ).join(' &nbsp;·&nbsp; ');
  });

  const btn100 = $('#btn-base100');
  if (btn100) btn100.onclick = () => { estado.g.base100 = !estado.g.base100; desenharGraficos(); };
}

/**
 * Aviso honesto sobre o gráfico: quantos dias daquela janela ainda
 * são curva estimada, e não cotação real coletada dia a dia.
 */
function notaHistorico(produtoId, regiaoId, janela) {
  if (!D.precoEhReal(produtoId, regiaoId)) return '';   // já avisado como simulado

  const reais = D.pregoesReais(produtoId, regiaoId);
  const estimados = Math.max(0, janela - reais);
  if (estimados <= 0) return '';

  const desde = D.realDesde(produtoId, regiaoId);
  return `<div style="display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.5;
      background:var(--ambar-claro);color:var(--terra);padding:9px 11px;border-radius:9px;margin-bottom:12px">
    ${icone('aviso', 15)}<div>O preço de hoje é real, mas <b>${estimados} dos ${janela} pontos</b> deste gráfico
    ainda são curva estimada — é o trecho <b>tracejado</b>. A parte <b>sólida</b> é cotação coletada de verdade,
    desde <b>${D.dataLonga(desde)}</b>. A cada dia o tracejado encolhe.</div></div>`;
}

function variacaoNoPeriodo(serie) {
  const vals = serie.map(d => d.valor);
  const ini = vals[0], fim = vals[vals.length - 1];
  return { min: Math.min(...vals), max: Math.max(...vals), pct: ini ? ((fim - ini) / ini) * 100 : 0 };
}

function rotuloPeriodo(p) {
  return { dia: 'de ontem para hoje', semana: 'na semana', mes: 'no mês', trimestre: 'no trimestre', ano: 'no ano' }[p] || '';
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
  const f = $('.fundo-janela');
  if (f) f.remove();
  document.body.style.overflow = '';
}

function avisar(texto) {
  const antigo = $('#torradinha'); if (antigo) antigo.remove();
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
    <div style="font-size:13.5px;max-width:340px;margin:0 auto;line-height:1.6">${texto}</div></div>`;
}

/** Em que faixa de largura a tela está (celular / tablet / PC) */
function faixaDaTela() {
  const l = window.innerWidth;
  return l < 480 ? 'p' : l < 760 ? 'm' : 'g';
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
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

  $('#btn-sair').onclick = () => {
    Auth.sair();
    location.reload();
  };

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

  /* Se a tela mudar de tamanho (girar o celular, redimensionar a janela),
     os gráficos precisam ser redesenhados na proporção certa. */
  let faixaTela = faixaDaTela();
  let espera;
  window.addEventListener('resize', () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const nova = faixaDaTela();
      if (nova === faixaTela) return;
      faixaTela = nova;
      if (!estado.usuario) return;
      if (estado.pagina === 'graficos') desenharGraficos();
      if (estado.pagina === 'precos') desenharPrecos();
    }, 250);
  });

  montarLogin();

  /* Avisa (só para você) quando o login na nuvem ainda não foi configurado.
     Sem isso dá para achar que o cadastro está valendo para todo mundo,
     quando na verdade ele está preso naquele aparelho. */
  if (Auth.faltaConfigurarNuvem()) {
    $('#aviso-modo-login').innerHTML = `<div class="recado info" style="margin-top:14px">
      ${icone('aviso', 16)}<span><b>Modo de teste.</b> O login na nuvem ainda não foi
      configurado, então o cadastro fica salvo só neste aparelho.
      Preencha a URL e a chave do Supabase em <b>js/config.js</b>.</span></div>`;
  }

  // Já estava logado? Entra direto.
  const salvo = Auth.usuarioAtual();
  if (salvo) abrirApp(salvo);
  else $('#tela-login').classList.remove('oculto');
}

document.addEventListener('DOMContentLoaded', iniciar);
