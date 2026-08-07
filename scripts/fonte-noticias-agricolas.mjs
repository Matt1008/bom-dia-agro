/* ============================================================
   FONTE: NOTÍCIAS AGRÍCOLAS  —  boi e novilha do Mato Grosso

   POR QUE ESTA FONTE

   O indicador nacional do CEPEA não serve para o MT. Em 06/08/2026
   o nacional estava em R$ 348,30/@ e Cuiabá em R$ 322,75/@ — R$ 26
   de diferença por arroba. Num caminhão de 500 arrobas dá R$ 13 mil.
   Mostrar o nacional para quem vende em Sorriso é enganoso.

   DE QUEM É O DADO (o app credita os dois na tela)

     · Boi por cidade  -> IMEA, Instituto Mato-grossense de Economia
                          Agropecuária. 8 praças de MT.
     · Novilha por UF  -> Datagro.

   O Notícias Agrícolas publica as duas tabelas com o crédito da
   fonte. O robots.txt deles libera o acesso e os preços vêm como
   texto normal — nada de contornar proteção.

   (O Agrolink foi descartado de propósito: lá o preço é um pedaço
   de imagem com nome sorteado, uma trava anti-cópia deliberada.)
   ============================================================ */

const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const PAGINA = 'https://www.noticiasagricolas.com.br/cotacoes/boi-gordo';

/* ------------------------------------------------------------
   Ferramentas de leitura
   ------------------------------------------------------------ */
function semTags(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/\s+/g, ' ')
    .trim();
}

/** "3.356,80" -> 3356.8   ·   "322,50" -> 322.5   ·   "+0,44" -> 0.44 */
function numeroBR(texto) {
  const m = (texto || '').match(/(-|\+)?\s*([\d.]*\d,\d{1,4})/);
  if (!m) return null;
  const n = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return m[1] === '-' ? -n : n;
}

/** "Atualizado em: 06/08/2026" -> "2026-08-06" */
function dataDaTabela(texto) {
  const m = (texto || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** vira "Barra do Garças" -> "barra-do-garcas" */
export function apelido(nome) {
  return (nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Quebra a página em tabelas, guardando o texto que vem ANTES de cada
 * uma. É esse texto que diz de quem é o dado ("Fonte: IMEA...").
 */
function tabelasComContexto(html) {
  const partes = html.split(/(<table[\s\S]*?<\/table>)/);
  const saida = [];
  for (let i = 0; i < partes.length; i++) {
    if (!partes[i].startsWith('<table')) continue;
    saida.push({
      contexto: semTags(partes[i - 1] || '').slice(-300),
      linhas: (partes[i].match(/<tr[\s\S]*?<\/tr>/g) || []).map(tr =>
        (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map(semTags)
      ),
      texto: semTags(partes[i])
    });
  }
  return saida;
}

/** Acha a tabela cujo contexto casa com a marca pedida */
function acharTabela(tabelas, marca) {
  return tabelas.find(t => marca.test(t.contexto));
}

/* ------------------------------------------------------------
   BUSCA PRINCIPAL
   ------------------------------------------------------------ */
export async function buscar() {
  const r = await fetch(PAGINA, {
    headers: {
      'User-Agent': AGENTE,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9'
    },
    signal: AbortSignal.timeout(30000)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  const html = await r.text();
  const tabelas = tabelasComContexto(html);
  const avisos = [];

  /* ---------- 1) BOI POR CIDADE — IMEA ---------- */
  const cidades = [];
  let dataBoi = null;

  const tBoi = acharTabela(tabelas, /Boi\s+.?\s*Vista\s*-?\s*IMEA|IMEA\s*-\s*Instituto Mato-grossense/i);
  if (!tBoi) {
    avisos.push('Tabela do boi por cidade (IMEA) não encontrada na página.');
  } else {
    dataBoi = dataDaTabela(tBoi.texto);
    for (const cels of tBoi.linhas) {
      if (cels.length < 2) continue;
      const nome = cels[0];
      // pula cabeçalho e rodapé
      if (/mun[ií]|pio|ver hist|atualizado/i.test(nome) || !nome) continue;

      const preco = numeroBR(cels[1]);
      if (preco == null || preco <= 0) continue;

      cidades.push({
        id: apelido(nome),
        nome,
        preco,
        variacao: cels[2] != null ? numeroBR(cels[2]) : null
      });
    }
    if (!cidades.length) avisos.push('Tabela do IMEA encontrada, mas sem cidades legíveis.');
  }

  /* ---------- 2) NOVILHA POR ESTADO — Datagro ---------- */
  let novilha = null;

  const tNov = acharTabela(tabelas, /Indicador\s+da\s+Novilha/i);
  if (!tNov) {
    avisos.push('Tabela do Indicador da Novilha (Datagro) não encontrada.');
  } else {
    const dataNov = dataDaTabela(tNov.texto);
    for (const cels of tNov.linhas) {
      if (cels.length < 2) continue;
      if (!/^mato grosso$/i.test(cels[0].trim())) continue;   // exatamente MT, não MS
      const preco = numeroBR(cels[1]);
      if (preco == null || preco <= 0) continue;
      novilha = { preco, variacao: cels[2] != null ? numeroBR(cels[2]) : null, data: dataNov };
      break;
    }
    if (!novilha) avisos.push('Tabela da Novilha encontrada, mas sem a linha do Mato Grosso.');
  }

  /* ---------- 3) Média das praças de MT ---------- */
  const mediaBoi = cidades.length
    ? Number((cidades.reduce((s, c) => s + c.preco, 0) / cidades.length).toFixed(2))
    : null;

  /* A variação da média é a média das variações das praças — todas
     publicadas pelo IMEA. Não é chute nosso. */
  const comVariacao = cidades.filter(c => c.variacao != null);
  const variacaoBoi = comVariacao.length
    ? Number((comVariacao.reduce((s, c) => s + c.variacao, 0) / comVariacao.length).toFixed(2))
    : null;

  return {
    data: dataBoi,
    boi: mediaBoi == null ? null : {
      preco: mediaBoi,
      variacao: variacaoBoi,
      cidades,
      data: dataBoi,
      praca: `Média de ${cidades.length} praças de MT — IMEA`,
      fonte: 'IMEA (via Notícias Agrícolas)'
    },
    novilha: novilha && {
      preco: novilha.preco,
      variacao: novilha.variacao,
      data: novilha.data || dataBoi,
      praca: 'Indicador da Novilha — Mato Grosso',
      fonte: 'Datagro (via Notícias Agrícolas)'
    },
    avisos
  };
}
