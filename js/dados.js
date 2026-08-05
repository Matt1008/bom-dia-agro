/* ============================================================
   DADOS — busca os preços, o histórico, as moedas e as notícias
   ============================================================ */

import { CONFIG } from './config.js';

export const BANCO = {
  precos: null,      // preço de hoje de cada produto/região
  historico: null,   // { datas: [...], series: { produto: { regiao: [...] } } }
  noticias: [],
  moedas: {},
  erro: null
};

/* Busca um JSON local, sem quebrar o app se der erro */
async function buscarJSON(caminho) {
  const r = await fetch(caminho + '?v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('Não consegui ler ' + caminho);
  return r.json();
}

/* ------------------------------------------------------------
   CARREGAR TUDO
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
   Se a internet estiver ruim, fica com o valor do arquivo. */
export async function carregarMoedas() {
  try {
    const r = await fetch(CONFIG.apiMoedas, { cache: 'no-store' });
    if (!r.ok) throw new Error('sem resposta');
    const d = await r.json();
    if (d.USDBRL) BANCO.moedas.USD = { nome: 'Dólar', valor: Number(d.USDBRL.bid), variacao: Number(d.USDBRL.pctChange), aoVivo: true };
    if (d.EURBRL) BANCO.moedas.EUR = { nome: 'Euro',  valor: Number(d.EURBRL.bid), variacao: Number(d.EURBRL.pctChange), aoVivo: true };
  } catch (e) {
    /* sem internet: mantém o que veio do arquivo */
  }
  return BANCO.moedas;
}

export async function carregarNoticias() {
  try {
    const d = await buscarJSON(CONFIG.arquivos.noticias);
    BANCO.noticias = Array.isArray(d.noticias) ? d.noticias : [];
    BANCO.noticiasAtualizadas = d.atualizado_em || null;
  } catch (e) {
    BANCO.noticias = [];
  }
  return BANCO.noticias;
}

/* ------------------------------------------------------------
   CONSULTAS
   ------------------------------------------------------------ */

/** Preço de hoje. Devolve { preco, praca } ou null. */
export function precoDe(produtoId, regiaoId) {
  return BANCO.precos?.produtos?.[produtoId]?.[regiaoId] || null;
}

/** Em quais regiões esse produto tem cotação? */
export function regioesDe(produtoId) {
  return Object.keys(BANCO.precos?.produtos?.[produtoId] || {});
}

/** Série histórica completa de um produto numa região. */
export function serieDe(produtoId, regiaoId) {
  const s = BANCO.historico?.series?.[produtoId]?.[regiaoId];
  return Array.isArray(s) ? s : [];
}

export function datas() {
  return BANCO.historico?.datas || [];
}

/** Últimos N pregões: [{ data, valor }, ...] */
export function ultimos(produtoId, regiaoId, quantos) {
  const s = serieDe(produtoId, regiaoId);
  const d = datas();
  const corte = Math.max(0, s.length - quantos);
  return s.slice(corte).map((valor, i) => ({ data: d[corte + i], valor }));
}

/* Quantos pregões (dias úteis) cabem em cada período */
export const PERIODOS = {
  dia:     { rotulo: 'Ontem',       curto: '1D',  pregoes: 2   },
  semana:  { rotulo: 'Semana',      curto: '7D',  pregoes: 6   },
  mes:     { rotulo: 'Mês',         curto: '1M',  pregoes: 22  },
  trimestre:{rotulo: 'Trimestre',   curto: '3M',  pregoes: 65  },
  ano:     { rotulo: 'Ano',         curto: '12M', pregoes: 9999 }
};

/**
 * Variação de preço num período.
 * Devolve { atual, anterior, dif, pct, direcao } — direcao: 'sobe' | 'desce' | 'igual'
 */
export function variacao(produtoId, regiaoId, periodo = 'dia') {
  const s = serieDe(produtoId, regiaoId);
  if (s.length < 2) return null;

  const pregoes = Math.min(PERIODOS[periodo]?.pregoes ?? 2, s.length);
  const atual = s[s.length - 1];
  const anterior = s[s.length - pregoes];
  const dif = atual - anterior;
  const pct = anterior ? (dif / anterior) * 100 : 0;

  return {
    atual, anterior, dif, pct,
    direcao: Math.abs(pct) < 0.05 ? 'igual' : (pct > 0 ? 'sobe' : 'desce')
  };
}

/**
 * Variação que o app PODE afirmar.
 *
 * Só devolve número quando existe cotação real coletada no período
 * inteiro. Enquanto a coleta diária é nova, o histórico anterior é
 * curva estimada — e uma variação calculada em cima dela seria um
 * número inventado com cara de informação. Nesse caso devolve null,
 * e a tela mostra "—".
 */
export function variacaoConfiavel(produtoId, regiaoId, periodo = 'dia') {
  if (!precoEhReal(produtoId, regiaoId)) return null;

  const s = serieDe(produtoId, regiaoId);
  const precisa = Math.min(PERIODOS[periodo]?.pregoes ?? 2, s.length);
  if (pregoesReais(produtoId, regiaoId) < precisa) return null;

  return variacao(produtoId, regiaoId, periodo);
}

/* ------------------------------------------------------------
   FORMATAÇÃO (tudo em português do Brasil)
   ------------------------------------------------------------ */
export function dinheiro(v, casas = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  const c = v < 10 && casas === 2 ? Math.max(2, Math.min(4, casas)) : casas;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
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
  const [a, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function dataLonga(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** "há 3 horas", "ontem", "12/07" */
export function tempoRelativo(iso) {
  if (!iso) return '';
  const agora = Date.now();
  const q = new Date(iso).getTime();
  if (Number.isNaN(q)) return '';
  const min = Math.round((agora - q) / 60000);
  if (min < 2) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return dataLonga(new Date(q).toISOString().slice(0, 10));
}

/** Quantas casas decimais mostrar (leite tem 4, bezerro tem 0) */
export function casasDe(produtoId) {
  if (produtoId === 'leite') return 4;
  if (produtoId === 'bezerro') return 0;
  return 2;
}

/* ------------------------------------------------------------
   DE ONDE VEIO O NÚMERO
   O app nunca esconde isso: cada preço sabe dizer se é uma
   cotação real (CEPEA) ou um valor simulado de demonstração.
   ------------------------------------------------------------ */

/** Aquele preço específico é cotação real? */
export function precoEhReal(produtoId, regiaoId) {
  return precoDe(produtoId, regiaoId)?.origem === 'real';
}

/** Desde quando esse par produto/região tem cotação real ('YYYY-MM-DD' ou null) */
export function realDesde(produtoId, regiaoId) {
  return BANCO.historico?.real_desde?.[produtoId]?.[regiaoId] || null;
}

/** Quantos pregões do fim da série já são reais (o resto é curva estimada) */
export function pregoesReais(produtoId, regiaoId) {
  const desde = realDesde(produtoId, regiaoId);
  if (!desde) return 0;
  const d = datas();
  const i = d.indexOf(desde);
  return i === -1 ? 0 : d.length - i;
}

/** Alguma coisa na tela ainda é simulada? */
export function ehExemplo() {
  return BANCO.precos?.origem !== 'real';
}

/** Tudo é simulado (a atualização automática nunca rodou)? */
export function tudoExemplo() {
  return BANCO.precos?.origem === 'exemplo' || !BANCO.precos?.origem;
}

/** { total, reais, exemplo } */
export function contagem() {
  if (BANCO.precos?.contagem) return BANCO.precos.contagem;
  let total = 0, reais = 0;
  for (const porRegiao of Object.values(BANCO.precos?.produtos || {}))
    for (const info of Object.values(porRegiao)) {
      total++;
      if (info.origem === 'real') reais++;
    }
  return { total, reais, exemplo: total - reais };
}
