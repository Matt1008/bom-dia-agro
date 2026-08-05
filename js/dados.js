/* ============================================================
   DADOS — busca os preços, o histórico, as moedas e as notícias

   Estrutura do histórico (cada série tem as SUAS datas):
     series[produto][regiao] = { d: ["2026-08-04", ...], v: [350.2, ...] }

   Por que cada série tem sua própria régua de datas? Porque cada
   cotação segue seu calendário: boi tem pregão todo dia útil,
   alguns indicadores são mensais. Régua única obrigaria a inventar
   valor para tapar buraco — e este app não inventa número.
   ============================================================ */

import { CONFIG } from './config.js';

export const BANCO = {
  precos: null,
  historico: null,
  noticias: [],
  moedas: {}
};

async function buscarJSON(caminho) {
  const r = await fetch(caminho + '?v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('Não consegui ler ' + caminho);
  return r.json();
}

/* ------------------------------------------------------------
   CARREGAR
   ------------------------------------------------------------ */
export async function carregarPrecos() {
  const [precos, historico] = await Promise.all([
    buscarJSON(CONFIG.arquivos.precos),
    buscarJSON(CONFIG.arquivos.historico)
  ]);
  BANCO.precos = precos;
  BANCO.historico = historico;
  BANCO.moedas = precos.moedas || {};
  return BANCO;
}

/* Moedas ao vivo (AwesomeAPI, gratuita).
   Sem internet, fica com o valor gravado no arquivo. */
export async function carregarMoedas() {
  try {
    const r = await fetch(CONFIG.apiMoedas, { cache: 'no-store' });
    if (!r.ok) throw new Error('sem resposta');
    const d = await r.json();
    if (d.USDBRL) BANCO.moedas.USD = { nome: 'Dólar', valor: Number(d.USDBRL.bid), variacao: Number(d.USDBRL.pctChange), aoVivo: true };
    if (d.EURBRL) BANCO.moedas.EUR = { nome: 'Euro',  valor: Number(d.EURBRL.bid), variacao: Number(d.EURBRL.pctChange), aoVivo: true };
  } catch {
    /* sem internet: mantém o que veio do arquivo */
  }
  return BANCO.moedas;
}

export async function carregarNoticias() {
  try {
    const d = await buscarJSON(CONFIG.arquivos.noticias);
    BANCO.noticias = Array.isArray(d.noticias) ? d.noticias : [];
    BANCO.noticiasAtualizadas = d.atualizado_em || null;
  } catch {
    BANCO.noticias = [];
  }
  return BANCO.noticias;
}

/* ------------------------------------------------------------
   CONSULTAS
   ------------------------------------------------------------ */

/** Preço de hoje: { preco, data, praca, escopo, fonte } ou null */
export function precoDe(produtoId, regiaoId) {
  return BANCO.precos?.produtos?.[produtoId]?.[regiaoId] || null;
}

/** Em quais regiões esse produto tem cotação? */
export function regioesDe(produtoId) {
  return Object.keys(BANCO.precos?.produtos?.[produtoId] || {});
}

/** A série crua: { d: [...], v: [...] } */
export function serieDe(produtoId, regiaoId) {
  const s = BANCO.historico?.series?.[produtoId]?.[regiaoId];
  return (s && Array.isArray(s.d) && Array.isArray(s.v)) ? s : { d: [], v: [] };
}

/** Quantos pontos essa série já tem */
export function tamanhoSerie(produtoId, regiaoId) {
  return serieDe(produtoId, regiaoId).d.length;
}

/** Últimos N pontos: [{ data, valor }, ...] */
export function ultimos(produtoId, regiaoId, quantos) {
  const { d, v } = serieDe(produtoId, regiaoId);
  const corte = Math.max(0, d.length - quantos);
  return d.slice(corte).map((data, i) => ({ data, valor: v[corte + i] }));
}

/** Todos os pontos a partir de uma data (inclusive) */
export function desde(produtoId, regiaoId, dataISO) {
  const { d, v } = serieDe(produtoId, regiaoId);
  const saida = [];
  for (let i = 0; i < d.length; i++) if (d[i] >= dataISO) saida.push({ data: d[i], valor: v[i] });
  return saida;
}

/* ------------------------------------------------------------
   PERÍODOS
   'dias' = quantos dias de calendário o período cobre
   ------------------------------------------------------------ */
export const PERIODOS = {
  dia:       { rotulo: 'Ontem',     curto: '1D',  dias: 1 },
  semana:    { rotulo: 'Semana',    curto: '7D',  dias: 7 },
  mes:       { rotulo: 'Mês',       curto: '1M',  dias: 30 },
  trimestre: { rotulo: 'Trimestre', curto: '3M',  dias: 90 },
  ano:       { rotulo: 'Ano',       curto: '12M', dias: 365 }
};

/** Data ISO de N dias atrás */
function diasAtras(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Variação de preço num período.
 *
 * Só devolve número quando existe cotação real de verdade nos dois
 * extremos. Se a série ainda não alcança o período pedido, devolve
 * null e a tela mostra "—". Nunca chuta.
 *
 * { atual, anterior, dif, pct, direcao, de, ate }
 */
export function variacao(produtoId, regiaoId, periodo = 'dia') {
  const { d, v } = serieDe(produtoId, regiaoId);
  if (d.length < 2) return null;

  const atual = v[d.length - 1];
  const alvo = diasAtras(PERIODOS[periodo]?.dias ?? 1);

  /* Pega o último ponto com data <= alvo.
     Ex.: pedindo "ontem" numa segunda-feira, o pregão anterior é
     sexta — e é ela que serve de comparação, como no mercado. */
  let i = -1;
  for (let k = d.length - 2; k >= 0; k--) {
    if (d[k] <= alvo) { i = k; break; }
  }

  /* Para o período "dia" vale a regra do mercado: se não há ponto
     antigo o bastante, usa o pregão imediatamente anterior. */
  if (i === -1 && periodo === 'dia') i = d.length - 2;
  if (i === -1) return null;   // a série ainda não cobre esse período

  const anterior = v[i];
  if (!anterior) return null;

  const dif = atual - anterior;
  const pct = (dif / anterior) * 100;

  return {
    atual, anterior, dif, pct,
    de: d[i], ate: d[d.length - 1],
    direcao: Math.abs(pct) < 0.005 ? 'igual' : (pct > 0 ? 'sobe' : 'desce')
  };
}

/**
 * Os pontos que o gráfico deve desenhar para cada período.
 * "Diária" mostra os últimos pregões um a um; os outros recortam
 * por data. Sempre devolve pelo menos 2 pontos, se existirem.
 */
export function pontosDoPeriodo(produtoId, regiaoId, periodo) {
  if (periodo === 'dia') return ultimos(produtoId, regiaoId, 15);

  const recorte = desde(produtoId, regiaoId, diasAtras(PERIODOS[periodo]?.dias ?? 30));
  return recorte.length >= 2 ? recorte : ultimos(produtoId, regiaoId, 2);
}

/** A série cobre o período pedido? */
export function cobrePeriodo(produtoId, regiaoId, periodo) {
  const { d } = serieDe(produtoId, regiaoId);
  if (d.length < 2) return false;
  if (periodo === 'dia') return true;
  return d[0] <= diasAtras(PERIODOS[periodo]?.dias ?? 1);
}

/** Desde quando temos cotação guardada */
export function inicioDaSerie(produtoId, regiaoId) {
  return serieDe(produtoId, regiaoId).d[0] || null;
}

/* ------------------------------------------------------------
   ORIGEM DOS DADOS
   ------------------------------------------------------------ */
export function fontes() {
  return BANCO.precos?.fontes || [];
}

export function contagem() {
  if (BANCO.precos?.contagem) return BANCO.precos.contagem;
  let total = 0;
  for (const r of Object.values(BANCO.precos?.produtos || {})) total += Object.keys(r).length;
  return { total, reais: total, exemplo: 0 };
}

/** O que aquele número realmente é */
export const ESCOPOS = {
  nacional: {
    etiqueta: 'Indicador nacional',
    explica: 'É o indicador único do Brasil — a referência que o mercado usa. O preço na sua porteira varia com frete, prazo e negociação.'
  },
  porto: {
    etiqueta: 'Preço no porto',
    explica: 'É o preço no porto de exportação. Para chegar ao valor na fazenda, desconte o frete até o porto.'
  },
  vizinho: {
    etiqueta: 'Estado vizinho',
    explica: 'Não existe cotação pública deste produto no seu estado. Este é o mercado publicado mais próximo, e serve de referência.'
  },
  estado: {
    etiqueta: 'Cotação do estado',
    explica: 'Cotação levantada no próprio estado.'
  }
};

export function escopoDe(produtoId, regiaoId) {
  const e = precoDe(produtoId, regiaoId)?.escopo;
  return ESCOPOS[e] || null;
}

/* ------------------------------------------------------------
   FORMATAÇÃO (português do Brasil)
   ------------------------------------------------------------ */
export function dinheiro(v, casas = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function numero(v, casas = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function porcento(v) {
  if (v == null || Number.isNaN(v)) return '—';
  const sinal = v > 0 ? '+' : '';
  return sinal + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

export function dataCurta(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function dataLonga(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function tempoRelativo(iso) {
  if (!iso) return '';
  const q = new Date(iso).getTime();
  if (Number.isNaN(q)) return '';
  const min = Math.round((Date.now() - q) / 60000);
  if (min < 2) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return dataLonga(new Date(q).toISOString().slice(0, 10));
}

/** Casas decimais de cada produto */
export function casasDe(produtoId) {
  if (produtoId === 'bezerro') return 0;
  return 2;
}
