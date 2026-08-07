/* ============================================================
   ATUALIZAÇÃO DIÁRIA — Bom Dia Agro  (Mato Grosso e Pará)

   Roda sozinho todo dia (GitHub Actions) e busca:
     1. Preços no widget público do CEPEA/ESALQ-USP
     2. Dólar e Euro (AwesomeAPI)
     3. Notícias do agro (RSS)

   DUAS REGRAS QUE NÃO SE QUEBRAM:

   1) Nada é inventado. Se uma busca falhar, o valor anterior fica
      como está e o problema aparece no relatório. O app nunca
      mostra número simulado.

   2) O preço é gravado na DATA DA COTAÇÃO, não na data em que o
      robô rodou. Parece detalhe, mas era um bug feio: gravar a
      cotação de segunda com etiqueta de terça faz a comparação
      "hoje x ontem" nunca fechar.

   Fonte: CEPEA/ESALQ-USP — citada em todas as telas, no PDF e nas
   imagens exportadas, como a instituição pede.

   Rodar na sua máquina:   node scripts/atualizar-precos.mjs
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Nuvem from './nuvem.mjs';
import * as MatoGrosso from './fonte-noticias-agricolas.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DADOS = join(AQUI, '..', 'dados');

/* Nas rodadas de hora em hora só buscamos preço. As notícias ficam
   para as rodadas da manhã e da tarde — assim o site não é
   republicado oito vezes por dia à toa. */
const APENAS_PRECOS = process.env.APENAS_PRECOS === '1';

const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const relatorio = { ok: [], falhas: [] };

/* ============================================================
   AS FONTES DE PREÇO

   'indicador' — código do indicador no widget do CEPEA (conferidos
                 um por um; os que não existem foram descartados).
   'regioes'   — em que estados do app o preço aparece.
   'escopo'    — o QUE aquele número realmente é. O app escreve isso
                 na tela para ninguém confundir indicador nacional
                 com preço da porteira:
                   'nacional' → indicador único para o Brasil
                   'porto'    → preço no porto de exportação
                   'vizinho'  → cotado no estado vizinho publicado
   'converte'  — ajuste quando o CEPEA publica em outra unidade.

   >>> O CEPEA NÃO PUBLICA indicador de soja/milho específico de MT
   >>> ou PA. Não existe fonte pública gratuita para isso. Por isso
   >>> usamos o indicador nacional e o preço de porto, sempre com o
   >>> escopo escrito na tela. Ver o LEIA-ME.
   ============================================================ */
const ARROBA_EM_LIBRAS = 33.0693;   // 15 kg em libras-peso

const FONTES = [
  /* Boi no MT NÃO vem daqui — vem do IMEA, que é cotação de praça.
     O indicador nacional continua valendo só para o Pará, onde não
     existe fonte estadual pública. */
  { produto: 'boi-gordo',    indicador: 2,   regioes: ['pa'],
    praca: 'Indicador CEPEA/B3 — Brasil', escopo: 'nacional' },

  { produto: 'soja',         indicador: 92,  regioes: ['mt', 'pa'],
    praca: 'Soja Paranaguá (porto) — CEPEA', escopo: 'porto' },

  { produto: 'milho',        indicador: 77,  regioes: ['mt', 'pa'],
    praca: 'Indicador CEPEA/B3 — Campinas/SP', escopo: 'nacional' },

  { produto: 'algodao',      indicador: 54,  regioes: ['mt'],
    praca: 'Indicador CEPEA/ESALQ — Brasil', escopo: 'nacional',
    // CEPEA publica em centavos de real por libra-peso; o app mostra R$ por arroba
    converte: v => (v / 100) * ARROBA_EM_LIBRAS },

  { produto: 'bezerro',      indicador: 8,   regioes: ['mt'],
    praca: 'Mato Grosso do Sul — CEPEA', escopo: 'vizinho' },

  { produto: 'suino',        indicador: 124, regioes: ['mt'],
    praca: 'Carcaça especial — CEPEA', escopo: 'nacional' },

  { produto: 'frango',       indicador: 130, regioes: ['mt', 'pa'],
    praca: 'Frango resfriado — CEPEA', escopo: 'nacional' },

  { produto: 'cafe-conilon', indicador: 24,  regioes: ['pa'],
    praca: 'Robusta — Indicador CEPEA/ESALQ', escopo: 'nacional' }
];

/* Feeds de notícias (todos testados e respondendo) */
const FEEDS = [
  { fonte: 'Canal Rural',  url: 'https://www.canalrural.com.br/feed/' },
  { fonte: 'Agrolink',     url: 'https://www.agrolink.com.br/rss/noticias.xml' },
  { fonte: 'Compre Rural', url: 'https://www.comprerural.com/feed/' },
  { fonte: 'G1 Agro',      url: 'https://g1.globo.com/rss/g1/economia/agronegocios/' }
];

const MAX_NOTICIAS = 60;
const MAX_POR_FONTE = 15;
const MAX_PONTOS = 520;      // ~2 anos de pregões por série

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

/* "04/08/2026" -> "2026-08-04". O CEPEA às vezes manda só "07/2026"
   (indicador mensal) — nesse caso usamos o último dia daquele mês. */
function dataBR(texto) {
  const completa = (texto || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (completa) return `${completa[3]}-${completa[2]}-${completa[1]}`;

  const mensal = (texto || '').match(/^(\d{2})\/(\d{4})$/);
  if (mensal) {
    const ultimo = new Date(Number(mensal[2]), Number(mensal[1]), 0).getDate();
    return `${mensal[2]}-${mensal[1]}-${String(ultimo).padStart(2, '0')}`;
  }
  return null;
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
  const data = dataBR(celulas[0]);
  if (valor == null || valor <= 0) return null;
  if (!data) { relatorio.falhas.push(`Indicador ${id}: veio sem data legível ("${celulas[0]}") — descartado`); return null; }

  return { valor, data, descricao: celulas[1] };
}

async function buscarPrecos() {
  const encontrados = {};
  let indicadoresOk = 0;

  for (const f of FONTES) {
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
          data: r.data,
          praca: f.praca,
          escopo: f.escopo,
          fonte: 'CEPEA/ESALQ-USP'
        };
      }

      indicadoresOk++;
      relatorio.ok.push(`Preço · ${f.produto}: ${valor} (${r.descricao}, cotação de ${r.data})`);
    } catch (e) {
      relatorio.falhas.push(`Preço · ${f.produto} (indicador ${f.indicador}): ${e.message}`);
    }
    await dormir(700);   // educação com o servidor do CEPEA
  }

  return { encontrados, indicadoresOk };
}

/* ============================================================
   1b) MATO GROSSO — boi por praça (IMEA) e novilha (Datagro)
   ============================================================ */
async function buscarMatoGrosso(encontrados) {
  const cidades = {};   // { produto: { regiao: { cidadeId: {...} } } }

  try {
    const mt = await MatoGrosso.buscar();
    mt.avisos.forEach(a => relatorio.falhas.push(`MT · ${a}`));

    if (mt.boi) {
      encontrados['boi-gordo'] ??= {};
      encontrados['boi-gordo']['mt'] = {
        preco: mt.boi.preco,
        data: mt.boi.data,
        praca: mt.boi.praca,
        escopo: 'estado',
        fonte: mt.boi.fonte,
        variacao_fonte: mt.boi.variacao
      };

      cidades['boi-gordo'] = { mt: {} };
      for (const c of mt.boi.cidades) {
        cidades['boi-gordo'].mt[c.id] = {
          nome: c.nome,
          preco: c.preco,
          data: mt.boi.data,
          variacao_fonte: c.variacao
        };
      }
      relatorio.ok.push(`Preço · boi-gordo/mt: ${mt.boi.preco} (média de ${mt.boi.cidades.length} praças IMEA, cotação de ${mt.boi.data})`);
    }

    if (mt.novilha) {
      encontrados['novilha'] ??= {};
      encontrados['novilha']['mt'] = {
        preco: mt.novilha.preco,
        data: mt.novilha.data,
        praca: mt.novilha.praca,
        escopo: 'estado',
        fonte: mt.novilha.fonte,
        variacao_fonte: mt.novilha.variacao
      };
      relatorio.ok.push(`Preço · novilha/mt: ${mt.novilha.preco} (Datagro, cotação de ${mt.novilha.data})`);
    }
  } catch (e) {
    relatorio.falhas.push(`Mato Grosso (boi/novilha): ${e.message}`);
  }

  return cidades;
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
    return anteriores || {};
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
   HISTÓRICO

   Cada série guarda suas PRÓPRIAS datas:
     { d: ["2026-08-04", "2026-08-05"], v: [350.20, 348.55] }

   Assim cada produto segue o calendário da sua cotação. Boi tem
   pregão todo dia útil; açúcar de Pernambuco é mensal. Uma régua
   de datas só, compartilhada, obrigaria a inventar valor para
   preencher buraco — e valor inventado é exatamente o que este
   app não faz.
   ============================================================ */
/**
 * Troca de fonte APAGA a série e recomeça.
 *
 * Isso não é exagero. Quando o boi do MT saiu do indicador nacional
 * do CEPEA (R$ 348) para a cotação de praça do IMEA (R$ 321), juntar
 * as duas na mesma linha faria o app anunciar uma queda de 7,6% que
 * nunca aconteceu — foi só a régua que mudou. Alguém podia decidir
 * uma venda em cima disso. Melhor perder o histórico antigo e
 * recomeçar honesto.
 */
function conferirFonte(serie, fonte) {
  if (!fonte) return false;
  if (serie.fonte && serie.fonte !== fonte) {
    serie.d = []; serie.v = [];
    serie.fonte = fonte;
    return true;    // avisa que zerou
  }
  serie.fonte = fonte;
  return false;
}

function guardarNoHistorico(serie, data, valor) {
  serie.d ??= []; serie.v ??= [];

  const ultima = serie.d[serie.d.length - 1];

  if (ultima === data) {           // mesma cotação: corrige o valor
    serie.v[serie.v.length - 1] = valor;
    return 'atualizado';
  }
  if (ultima && data < ultima) {   // cotação mais velha: já passou, ignora
    return 'ignorado';
  }

  serie.d.push(data);              // cotação nova
  serie.v.push(valor);

  if (serie.d.length > MAX_PONTOS) {
    serie.d = serie.d.slice(-MAX_PONTOS);
    serie.v = serie.v.slice(-MAX_PONTOS);
  }
  return 'novo';
}

/* ============================================================
   JUNTA TUDO E GRAVA
   ============================================================ */
/** Retrato do que importa num arquivo, para saber se mudou de verdade.
    Ignora o carimbo de hora: senão todo arquivo "mudaria" toda rodada
    e o site seria republicado à toa de hora em hora. */
function retrato(precos, historico) {
  return JSON.stringify({
    p: precos.produtos, c: precos.cidades,
    h: historico.series, hc: historico.cidades
  });
}

async function principal() {
  const agora = new Date();
  console.log(`\n=== Bom Dia Agro — atualização de ${agora.toLocaleString('pt-BR')} ===`);
  console.log(APENAS_PRECOS ? '(rodada rápida: só preços)\n' : '(rodada completa)\n');

  const precos = lerJSON('precos.json', { produtos: {}, moedas: {} });
  const historico = lerJSON('historico.json', { series: {} });
  historico.series ??= {};

  const antes = retrato(precos, historico);

  if (!APENAS_PRECOS) {
    gravarJSON('noticias.json', await buscarNoticias(), true);
  } else {
    relatorio.ok.push('Notícias: puladas nesta rodada');
  }

  precos.moedas = await buscarMoedas(precos.moedas);

  const { encontrados, indicadoresOk } = await buscarPrecos();
  const cidadesNovas = await buscarMatoGrosso(encontrados);

  /* --- grava preço de hoje + ponto no histórico --- */
  precos.produtos ??= {};
  precos.cidades ??= {};
  historico.cidades ??= {};
  let novos = 0, atualizados = 0;

  for (const [produto, porRegiao] of Object.entries(encontrados)) {
    precos.produtos[produto] ??= {};
    historico.series[produto] ??= {};

    for (const [regiao, novo] of Object.entries(porRegiao)) {
      precos.produtos[produto][regiao] = novo;

      const serie = (historico.series[produto][regiao] ??= { d: [], v: [] });

      if (conferirFonte(serie, novo.fonte)) {
        relatorio.ok.push(`Série ${produto}/${regiao} ZERADA: a fonte mudou para "${novo.fonte}" (números antigos não eram comparáveis)`);
      }

      const r = guardarNoHistorico(serie, novo.data, novo.preco);
      if (r === 'novo') novos++;
      if (r === 'atualizado') atualizados++;
    }
  }

  /* --- as praças (cidades) têm histórico próprio, uma série cada --- */
  let cidadesGravadas = 0;
  for (const [produto, porRegiao] of Object.entries(cidadesNovas)) {
    precos.cidades[produto] ??= {};
    historico.cidades[produto] ??= {};

    for (const [regiao, lista] of Object.entries(porRegiao)) {
      precos.cidades[produto][regiao] = lista;
      historico.cidades[produto][regiao] ??= {};

      for (const [cidadeId, info] of Object.entries(lista)) {
        historico.cidades[produto][regiao][cidadeId] ??= { d: [], v: [] };
        guardarNoHistorico(historico.cidades[produto][regiao][cidadeId], info.data, info.preco);
        cidadesGravadas++;
      }
    }
  }

  /* --- resumo do que está no ar --- */
  let cotacoes = 0;
  for (const porRegiao of Object.values(precos.produtos)) cotacoes += Object.keys(porRegiao).length;

  /* Fontes realmente usadas nesta rodada — o app cita todas na tela */
  const fontes = [...new Set(
    Object.values(precos.produtos).flatMap(r => Object.values(r)).map(i => i.fonte).filter(Boolean)
  )].sort();

  precos.origem = cotacoes > 0 ? 'real' : 'vazio';
  precos.fontes = fontes;
  precos.contagem = { total: cotacoes, reais: cotacoes, exemplo: 0 };

  /* --- só grava se algum número mudou de verdade --- */
  const mudou = retrato(precos, historico) !== antes;

  if (mudou) {
    precos.atualizado_em = agora.toISOString();
    gravarJSON('precos.json', precos, true);
    gravarJSON('historico.json', historico, true);
  }

  /* ============================================================
     CÓPIA NA NUVEM (Supabase)
     Roda sempre que as chaves existirem, mesmo quando nada mudou:
     é barato e garante que o banco nunca fique para trás.
     ============================================================ */
  let nuvem = 'desligada (sem SUPABASE_URL / SUPABASE_SERVICE_KEY)';

  if (Nuvem.ligado()) {
    try {
      const linhas = [];
      for (const [produto, porRegiao] of Object.entries(historico.series)) {
        for (const [regiao, s] of Object.entries(porRegiao)) {
          const info = precos.produtos?.[produto]?.[regiao] || {};
          for (let i = 0; i < s.d.length; i++) {
            linhas.push({
              produto, regiao,
              data: s.d[i],
              preco: s.v[i],
              praca: info.praca || null,
              escopo: info.escopo || null,
              fonte: info.fonte || 'CEPEA/ESALQ-USP',
              // o último ponto da série ainda pode mudar hoje; os anteriores, não
              fechado: i < s.d.length - 1
            });
          }
        }
      }

      const { gravadas } = await Nuvem.guardar(linhas);
      const fechadas = await Nuvem.fecharDia();
      const total = await Nuvem.contar();

      nuvem = `${gravadas} linha(s) enviadas · ${fechadas} fechamento(s) · ${total ?? '?'} linhas guardadas no total`;
    } catch (e) {
      nuvem = `FALHOU — ${e.message}`;
      relatorio.falhas.push(`Nuvem: ${e.message}`);
    }
  }

  /* --- relatório --- */
  console.log('SUCESSOS:');
  relatorio.ok.forEach(l => console.log('  + ' + l));
  if (relatorio.falhas.length) {
    console.log('\nAVISOS:');
    relatorio.falhas.forEach(l => console.log('  ! ' + l));
  }

  console.log(`\nIndicadores CEPEA obtidos: ${indicadoresOk}/${FONTES.length}`);
  console.log(`Praças de MT gravadas: ${cidadesGravadas}`);
  console.log(`Histórico: ${novos} ponto(s) novo(s), ${atualizados} corrigido(s)`);
  console.log(`Arquivos: ${mudou ? 'GRAVADOS (algo mudou)' : 'inalterados (nada mudou — site não será republicado)'}`);
  console.log(`Nuvem: ${nuvem}`);
  console.log(`Cotações no app: ${cotacoes} (todas reais)\n`);

  console.log('Tamanho das séries:');
  for (const [produto, porRegiao] of Object.entries(historico.series))
    for (const [regiao, s] of Object.entries(porRegiao))
      console.log(`  ${produto}/${regiao}: ${s.d.length} pontos (${s.d[0]} a ${s.d[s.d.length - 1]})`);
  console.log('');
}

principal().catch(e => { console.error('Erro geral:', e); process.exit(1); });
