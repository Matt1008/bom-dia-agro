/* ============================================================
   NUVEM — guarda o histórico no Supabase, para sempre

   Por que existe: os arquivos JSON da pasta /dados são a cópia
   que o site lê (rápida, funciona com internet ruim). O banco na
   nuvem é a cópia DURÁVEL — se o repositório sumir, se alguém
   apagar um arquivo sem querer, o histórico continua lá e dá para
   trazer de volta com scripts/restaurar-do-banco.mjs.

   Duas cópias do mesmo dado, com papéis diferentes. É de propósito.

   CHAVE: usa a SUPABASE_SERVICE_KEY, que passa por cima das regras
   de segurança do banco. Ela mora SÓ nos Secrets do GitHub e nunca,
   em hipótese alguma, dentro do site. Se esta variável não existir,
   o módulo simplesmente não faz nada e o robô continua funcionando
   normal — só sem a cópia na nuvem.
   ============================================================ */

const URL_BANCO = process.env.SUPABASE_URL || '';
const CHAVE     = process.env.SUPABASE_SERVICE_KEY || '';

export const ligado = () => Boolean(URL_BANCO && CHAVE);

function cabecalhos(extra = {}) {
  return {
    'apikey': CHAVE,
    'Authorization': `Bearer ${CHAVE}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function chamar(caminho, opcoes = {}) {
  const r = await fetch(`${URL_BANCO}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: cabecalhos(opcoes.headers),
    signal: AbortSignal.timeout(30000)
  });

  const texto = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

/* ------------------------------------------------------------
   GRAVAR
   Manda as linhas em lote. Se a linha (produto, regiao, data) já
   existir, ela é ATUALIZADA em vez de duplicada — por isso o robô
   pode rodar de hora em hora sem sujar o banco.
   ------------------------------------------------------------ */
export async function guardar(linhas) {
  if (!ligado() || !linhas.length) return { gravadas: 0 };

  const LOTE = 500;
  let gravadas = 0;

  for (let i = 0; i < linhas.length; i += LOTE) {
    const pedaco = linhas.slice(i, i + LOTE);
    await chamar('precos_historico?on_conflict=produto,regiao,data', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(pedaco)
    });
    gravadas += pedaco.length;
  }

  return { gravadas };
}

/* ------------------------------------------------------------
   FECHAR O DIA
   Marca como definitivo tudo que já não muda mais.
   ------------------------------------------------------------ */
export async function fecharDia() {
  if (!ligado()) return 0;
  const r = await chamar('rpc/fechar_dias_anteriores', {
    method: 'POST',
    body: JSON.stringify({})
  });
  return typeof r === 'number' ? r : 0;
}

/* ------------------------------------------------------------
   LER TUDO DE VOLTA
   Usado para reconstruir os arquivos JSON a partir do banco.
   Traz em páginas, porque um dia isso vai ter muita linha.
   ------------------------------------------------------------ */
export async function lerTudo() {
  if (!ligado()) return [];

  const PAGINA = 1000;
  const todas = [];
  let de = 0;

  for (;;) {
    const pedaco = await chamar(
      `precos_historico?select=produto,regiao,data,preco,praca,escopo,fonte,fechado&order=produto.asc,regiao.asc,data.asc&offset=${de}&limit=${PAGINA}`
    );
    if (!pedaco?.length) break;
    todas.push(...pedaco);
    if (pedaco.length < PAGINA) break;
    de += PAGINA;
  }

  return todas;
}

/* ------------------------------------------------------------
   CONTAR (para o relatório do robô)
   ------------------------------------------------------------ */
export async function contar() {
  if (!ligado()) return null;
  const r = await fetch(`${URL_BANCO}/rest/v1/precos_historico?select=produto`, {
    method: 'HEAD',
    headers: cabecalhos({ 'Prefer': 'count=exact', 'Range': '0-0' }),
    signal: AbortSignal.timeout(20000)
  });
  const faixa = r.headers.get('content-range');   // ex: "0-0/1234"
  const total = faixa?.split('/')?.[1];
  return total ? Number(total) : null;
}
