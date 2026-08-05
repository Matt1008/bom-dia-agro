/* ============================================================
   ATUALIZAÇÃO DIÁRIA — Bom Dia Agro

   Roda sozinho todo dia de manhã (pelo GitHub Actions) e busca:

     1. Preços reais no widget público do CEPEA/ESALQ-USP
     2. Cotação do Dólar e do Euro (AwesomeAPI)
     3. Notícias do agro (feeds RSS dos sites)

   REGRA DE OURO: se alguma busca falhar, o script NÃO inventa
   número. Ele mantém o valor anterior, deixa a marca "exemplo"
   naquele preço e avisa no relatório.

   Fonte dos preços: CEPEA/ESALQ-USP — dado público, uso livre
   com citação da fonte. O app cita em todas as telas e no PDF.

   Rodar na sua máquina:   node scripts/atualizar-precos.mjs
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DADOS = join(AQUI, '..', 'dados');

const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const relatorio = { ok: [], falhas: [] };

/* ============================================================
   AS FONTES DE PREÇO

   'indicador' = código do indicador no widget do CEPEA
                 (todos conferidos e funcionando).
   'regioes'   = em quais regiões do app aquele preço aparece.
   'nacional'  = true quando o CEPEA publica um indicador único
                 para o Brasil inteiro. Nesse caso o app mostra o
                 mesmo número em todas as regiões e escreve
                 "indicador nacional" na praça, para ninguém
                 achar que é um preço local.
   'converte'  = ajuste de unidade, quando o CEPEA publica numa
                 unidade diferente da que o app mostra.
   ============================================================ */
const ARROBA_EM_LIBRAS = 33.0693;   // 15 kg em libras-peso

const FONTES_CEPEA = [
  { produto: 'boi-gordo',    indicador: 2,   praca: 'Indicador CEPEA/B3 — nacional',       nacional: true,
    regioes: ['centro-oeste', 'sudeste', 'sul', 'norte', 'nordeste'] },

  { produto: 'bezerro',      indicador: 3,   praca: 'São Paulo (CEPEA)',                    regioes: ['sudeste'] },
  { produto: 'bezerro',      indicador: 8,   praca: 'Mato Grosso do Sul (CEPEA)',           regioes: ['centro-oeste'] },

  { produto: 'soja',         indicador: 12,  praca: 'Paraná (CEPEA/ESALQ)',                 regioes: ['sul'] },

  { produto: 'milho',        indicador: 77,  praca: 'Indicador CEPEA/B3 — Campinas/SP',     nacional: true,
    regioes: ['centro-oeste', 'sudeste', 'sul', 'nordeste', 'norte'] },

  { produto: 'cafe-arabica', indicador: 23,  praca: 'Indicador CEPEA/ESALQ — nacional',     nacional: true,
    regioes: ['sudeste', 'sul'] },
  { produto: 'cafe-conilon', indicador: 24,  praca: 'Robusta — Indicador CEPEA/ESALQ',      nacional: true,
    regioes: ['sudeste', 'norte'] },

  { produto: 'algodao',      indicador: 54,  praca: 'Indicador CEPEA/ESALQ — nacional',     nacional: true,
    regioes: ['centro-oeste', 'nordeste', 'sudeste'],
    // CEPEA publica em centavos de real por libra-peso; o app mostra R$ por arroba
    converte: v => (v / 100) * ARROBA_EM_LIBRAS },

  { produto: 'trigo',        indicador: 178, praca: 'Paraná (CEPEA/ESALQ)',                 regioes: ['sul'],
    // CEPEA publica em R$ por tonelada; o app mostra R$ por saca de 60 kg
    converte: v => v * 0.06 },

  { produto: 'arroz',        indicador: 126, praca: 'Média CEPEA/IRGA — Rio Grande do Sul', regioes: ['sul'] },

  { produto: 'suino',        indicador: 124, praca: 'Carcaça especial — CEPEA',             nacional: true,
    regioes: ['sul', 'sudeste', 'centro-oeste'] },

  { produto: 'frango',       indicador: 130, praca: 'Frango resfriado — CEPEA',             nacional: true,
    regioes: ['sul', 'sudeste', 'centro-oeste', 'nordeste'] },

  { produto: 'acucar',       indicador: 53,  praca: 'São Paulo (CEPEA)',                    regioes: ['sudeste'] },
  { produto: 'acucar',       indicador: 35,  praca: 'Pernambuco (CEPEA)',                   regioes: ['nordeste'] },

  { produto: 'mandioca',     indicador: 72,  praca: 'Paraná (CEPEA)',                       regioes: ['sul'] },

  { produto: 'laranja',      indicador: 162, praca: 'Citros — São Paulo (CEPEA)',           regioes: ['sudeste'] }
];

/* Feeds de notícias do agro (todos testados e respondendo) */
const FEEDS = [
  { fonte: 'Canal Rural',  url: 'https://www.canalrural.com.br/feed/' },
  { fonte: 'Agrolink',     url: 'https://www.agrolink.com.br/rss/noticias.xml' },
  { fonte: 'Compre Rural', url: 'https://www.comprerural.com/feed/' },
  { fonte: 'G1 Agro',      url: 'https://g1.globo.com/rss/g1/economia/agronegocios/' },
  { fonte: 'Summit Agro',  url: 'https://summitagro.estadao.com.br/feed/' }
];

const MAX_NOTICIAS = 60;
const MAX_POR_FONTE = 14;

/* ------------------------------------------------------------
   Ferramentas
   ------------------------------------------------------------ */
async function buscar(url, segundos = 25) {
  const r = await fetch(url, {
    headers: { 'User-Agent': AGENTE, 'Accept': '*/*' },
    signal: AbortSignal.timeout(segundos * 1000)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function lerJSON(arquivo, padrao) {
  const caminho = join(DADOS, arquivo);
  if (!existsSync(caminho)) return padrao;
  try { return JSON.parse(readFileSync(caminho, 'utf8')); } catch { return padrao; }
}

function gravarJSON(arquivo, dados, bonito = false) {
  writeFileSync(join(DADOS, arquivo), JSON.stringify(dados, null, bonito ? 1 : 0), 'utf8');
}

const hoje = () => new Date().toISOString().slice(0, 10);
const ehFimDeSemana = () => [0, 6].includes(new Date().getDay());
const dormir = ms => new Promise(r => setTimeout(r, ms));

function limpar(txt) {
  return (txt || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/\s+/g, ' ')
    .trim();
}

function pegarTag(bloco, tag) {
  const m = bloco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? limpar(m[1]) : '';
}

/* "R$ 3.151,95" ou "¢R$ 419,86"  ->  3151.95 / 419.86 */
function numeroBR(texto) {
  const m = (texto || '').match(/([\d.]+,\d{1,4})/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* "04/08/2026" -> "2026-08-04"  (o CEPEA às vezes manda só "07/2026") */
function dataBR(texto) {
  const m = (texto || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/* ============================================================
   1) PREÇOS — CEPEA/ESALQ
   ============================================================ */
async function umIndicador(id) {
  const url = `https://www.cepea.esalq.usp.br/br/widgetproduto.js.php?fonte=arial&tamanho=10&largura=400px&id_indicador[]=${id}`;
  const txt = await buscar(url);

  const corpo = txt.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!corpo) return null;
  const linha = corpo[1].match(/<tr[\s\S]*?<\/tr>/i);
  if (!linha) return null;

  const celulas = (linha[0].match(/<td[\s\S]*?<\/td>/gi) || []).map(limpar);
  if (celulas.length < 3) return null;   // "Sem resultados" vem com 1 célula

  const valor = numeroBR(celulas[2]);
  if (valor == null || valor <= 0) return null;

  return { valor, data: dataBR(celulas[0]), descricao: celulas[1] };
}

async function buscarPrecos() {
  const encontrados = {};   // { produto: { regiao: { preco, praca, origem, fonte, data } } }
  let quantos = 0;

  for (const f of FONTES_CEPEA) {
    try {
      const r = await umIndicador(f.indicador);
      if (!r) {
        relatorio.falhas.push(`Preço · ${f.produto} (indicador ${f.indicador}): sem resultado`);
        continue;
      }

      const valor = Number((f.converte ? f.converte(r.valor) : r.valor).toFixed(4));

      for (const regiao of f.regioes) {
        encontrados[f.produto] ??= {};
        encontrados[f.produto][regiao] = {
          preco: valor,
          praca: f.praca,
          origem: 'real',
          fonte: 'CEPEA/ESALQ-USP',
          nacional: !!f.nacional,
          data: r.data
        };
      }

      quantos++;
      relatorio.ok.push(`Preço · ${f.produto}: ${valor} (${r.descricao}, ${r.data || 's/ data'})`);
    } catch (e) {
      relatorio.falhas.push(`Preço · ${f.produto} (indicador ${f.indicador}): ${e.message}`);
    }
    await dormir(700);   // educação com o servidor do CEPEA (e evita bloqueio por excesso)
  }

  return { encontrados, quantos };
}

/* ============================================================
   2) MOEDAS
   ============================================================ */
async function buscarMoedas(anteriores) {
  try {
    const d = JSON.parse(await buscar('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL'));
    const saida = {};
    if (d.USDBRL) saida.USD = { nome: 'Dólar', valor: Number(d.USDBRL.bid), variacao: Number(d.USDBRL.pctChange) };
    if (d.EURBRL) saida.EUR = { nome: 'Euro',  valor: Number(d.EURBRL.bid), variacao: Number(d.EURBRL.pctChange) };
    if (!Object.keys(saida).length) throw new Error('resposta vazia');
    relatorio.ok.push('Moedas: Dólar e Euro atualizados');
    return saida;
  } catch (e) {
    relatorio.falhas.push(`Moedas: ${e.message}`);
    return anteriores;
  }
}

/* ============================================================
   3) NOTÍCIAS
   ============================================================ */
async function buscarNoticias() {
  const todas = [];

  for (const feed of FEEDS) {
    try {
      const xml = await buscar(feed.url);
      const itens = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
      let contados = 0;

      for (const item of itens) {
        if (contados >= MAX_POR_FONTE) break;

        const titulo = pegarTag(item, 'title');
        let link = pegarTag(item, 'link');
        if (!link) {
          const m = item.match(/<link[^>]*href="([^"]+)"/i);
          link = m ? m[1] : '';
        }
        if (!titulo || !link) continue;

        const bruta = pegarTag(item, 'pubDate') || pegarTag(item, 'published') || pegarTag(item, 'updated');
        const quando = bruta ? new Date(bruta) : new Date();

        todas.push({
          titulo,
          link,
          fonte: feed.fonte,
          resumo: (pegarTag(item, 'description') || pegarTag(item, 'summary')).slice(0, 260),
          data: Number.isNaN(quando.getTime()) ? new Date().toISOString() : quando.toISOString()
        });
        contados++;
      }
      relatorio.ok.push(`Notícias · ${feed.fonte}: ${contados}`);
    } catch (e) {
      relatorio.falhas.push(`Notícias · ${feed.fonte}: ${e.message}`);
    }
  }

  const vistas = new Set();
  const limpas = todas
    .filter(n => {
      const chave = n.titulo.toLowerCase().slice(0, 70);
      if (vistas.has(chave)) return false;
      vistas.add(chave); return true;
    })
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, MAX_NOTICIAS);

  if (!limpas.length) {
    relatorio.falhas.push('Nenhuma notícia obtida — mantendo as anteriores.');
    return lerJSON('noticias.json', { atualizado_em: null, noticias: [] });
  }
  return { atualizado_em: new Date().toISOString(), noticias: limpas };
}

/* ============================================================
   JUNTA TUDO E GRAVA
   ============================================================ */
async function principal() {
  console.log(`\n=== Bom Dia Agro — atualização de ${hoje()} ===\n`);

  const precos = lerJSON('precos.json', null);
  const historico = lerJSON('historico.json', null);
  if (!precos || !historico) {
    console.error('Faltam os arquivos de dados. Rode antes:  node scripts/gerar-dados-exemplo.mjs');
    process.exit(1);
  }

  gravarJSON('noticias.json', await buscarNoticias(), true);
  precos.moedas = await buscarMoedas(precos.moedas);

  const { encontrados, quantos } = await buscarPrecos();

  /* --- aplica os preços reais por cima --- */
  let cotacoesReais = 0;
  for (const [produto, porRegiao] of Object.entries(encontrados)) {
    for (const [regiao, novo] of Object.entries(porRegiao)) {
      precos.produtos[produto] ??= {};
      precos.produtos[produto][regiao] = { ...(precos.produtos[produto][regiao] || {}), ...novo };
      cotacoesReais++;
    }
  }

  /* --- conta quantas cotações da tela já são reais --- */
  let total = 0, reais = 0;
  for (const porRegiao of Object.values(precos.produtos))
    for (const info of Object.values(porRegiao)) {
      total++;
      if (info.origem === 'real') reais++;
    }

  /* ------------------------------------------------------------
     ENCAIXE DO HISTÓRICO

     Problema: o histórico de exemplo termina num nível diferente
     do preço real. Se a gente simplesmente colasse o valor real
     no fim, o app mostraria uma variação diária falsa e enorme
     (tipo "boi subiu 8,7% hoje"), o que seria uma mentira.

     Solução: no PRIMEIRO dia em que um produto passa a ter
     cotação real, o histórico simulado inteiro é reescalado para
     encaixar no nível real. O formato da curva continua sendo
     estimativa (e o app avisa isso), mas a variação do dia passa
     a ser honesta: 0% na virada, e real dali para frente.
     ------------------------------------------------------------ */
  historico.real_desde ??= {};
  for (const [produto, porRegiao] of Object.entries(encontrados)) {
    historico.real_desde[produto] ??= {};
    for (const [regiao, novo] of Object.entries(porRegiao)) {
      if (historico.real_desde[produto][regiao]) continue;   // já encaixado antes

      const serie = historico.series?.[produto]?.[regiao];
      const ultimo = serie?.[serie.length - 1];
      if (serie?.length && ultimo > 0) {
        const fator = novo.preco / ultimo;
        historico.series[produto][regiao] = serie.map(v => Number((v * fator).toFixed(4)));
        relatorio.ok.push(`Histórico encaixado · ${produto}/${regiao} (x${fator.toFixed(3)})`);
      }
      historico.real_desde[produto][regiao] = hoje();
    }
  }

  /* --- guarda o fechamento de hoje no histórico (só dia útil) --- */
  if (!ehFimDeSemana()) {
    const jaTemHoje = historico.datas[historico.datas.length - 1] === hoje();
    if (!jaTemHoje) historico.datas.push(hoje());

    for (const [produto, porRegiao] of Object.entries(precos.produtos)) {
      for (const [regiao, info] of Object.entries(porRegiao)) {
        historico.series[produto] ??= {};
        const serie = (historico.series[produto][regiao] ??= []);
        if (jaTemHoje) serie[serie.length - 1] = info.preco;
        else serie.push(info.preco);
      }
    }

    /* mantém no máximo 2 anos, para o arquivo não engordar */
    const LIMITE = 520;
    if (historico.datas.length > LIMITE) {
      const corte = historico.datas.length - LIMITE;
      historico.datas = historico.datas.slice(corte);
      for (const produto of Object.values(historico.series))
        for (const regiao of Object.keys(produto))
          produto[regiao] = produto[regiao].slice(corte);
    }
  }

  /* --- resumo honesto do que está no ar --- */
  precos.origem = reais > 0 ? (reais === total ? 'real' : 'misto') : 'exemplo';
  precos.fontes = reais > 0 ? ['CEPEA/ESALQ-USP'] : [];
  precos.contagem = { total, reais, exemplo: total - reais };
  precos.atualizado_em = new Date().toISOString();
  if (reais === total) delete precos.aviso;
  else precos.aviso = `${total - reais} de ${total} cotações ainda são simuladas (sem fonte pública configurada).`;

  gravarJSON('precos.json', precos, true);
  gravarJSON('historico.json', historico);

  console.log('SUCESSOS:');
  relatorio.ok.forEach(l => console.log('  + ' + l));
  if (relatorio.falhas.length) {
    console.log('\nAVISOS:');
    relatorio.falhas.forEach(l => console.log('  ! ' + l));
  }
  console.log(`\nIndicadores CEPEA obtidos: ${quantos}/${FONTES_CEPEA.length}`);
  console.log(`Cotações na tela: ${reais} reais + ${total - reais} de exemplo = ${total}`);
  console.log(`Origem geral: ${precos.origem.toUpperCase()}\n`);
}

principal().catch(e => { console.error('Erro geral:', e); process.exit(1); });
