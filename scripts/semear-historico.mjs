/* ============================================================
   SEMEAR O HISTÓRICO — Bom Dia Agro

   Cria dados/historico.json e dados/precos.json com o primeiro
   ponto de cada série.

   >>> IMPORTANTE: os valores abaixo NÃO são inventados. <<<
   São as cotações do CEPEA/ESALQ do pregão de 04/08/2026,
   coletadas pelo próprio scripts/atualizar-precos.mjs naquele dia
   e copiadas para cá para o app já nascer com dois dias reais de
   histórico (04/08 e o dia em que você rodar a atualização).

   Sem isso o app começaria com um ponto só, e a comparação
   "hoje x ontem" ficaria em branco até o dia seguinte.

   Rodar UMA VEZ:   node scripts/semear-historico.mjs
   Depois é o atualizar-precos.mjs que cuida de tudo.

   Quer recomeçar do zero, sem semente? Use:
       node scripts/semear-historico.mjs --vazio
   ============================================================ */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DADOS = join(AQUI, '..', 'dados');
const VAZIO = process.argv.includes('--vazio');

/* Pregão de 04/08/2026 — CEPEA/ESALQ-USP */
const DATA_SEMENTE = '2026-08-04';

const SEMENTE = [
  { produto: 'boi-gordo',    regioes: ['mt', 'pa'], preco: 350.20,
    praca: 'Indicador CEPEA/B3 — Brasil', escopo: 'nacional' },

  { produto: 'soja',         regioes: ['mt', 'pa'], preco: 144.12,
    praca: 'Soja Paranaguá (porto) — CEPEA', escopo: 'porto' },

  { produto: 'milho',        regioes: ['mt', 'pa'], preco: 65.17,
    praca: 'Indicador CEPEA/B3 — Campinas/SP', escopo: 'nacional' },

  { produto: 'algodao',      regioes: ['mt'],       preco: 138.8448,
    praca: 'Indicador CEPEA/ESALQ — Brasil', escopo: 'nacional' },

  { produto: 'bezerro',      regioes: ['mt'],       preco: 3369.17,
    praca: 'Mato Grosso do Sul — CEPEA', escopo: 'vizinho' },

  { produto: 'suino',        regioes: ['mt'],       preco: 7.53,
    praca: 'Carcaça especial — CEPEA', escopo: 'nacional' },

  { produto: 'frango',       regioes: ['mt', 'pa'], preco: 6.90,
    praca: 'Frango resfriado — CEPEA', escopo: 'nacional' },

  { produto: 'cafe-conilon', regioes: ['pa'],       preco: 1095.15,
    praca: 'Robusta — Indicador CEPEA/ESALQ', escopo: 'nacional' }
];

mkdirSync(DADOS, { recursive: true });

const caminhoHist = join(DADOS, 'historico.json');
const caminhoPrec = join(DADOS, 'precos.json');

/* Trava de segurança: este script APAGA o histórico e começa de novo.
   Se você já vem coletando preços há dias, não dá para rodar sem querer. */
if (existsSync(caminhoHist) && !process.argv.includes('--forcar')) {
  try {
    const atual = JSON.parse(readFileSync(caminhoHist, 'utf8'));
    const pontos = Object.values(atual.series || {})
      .flatMap(r => Object.values(r))
      .reduce((n, s) => n + (s.d?.length || 0), 0);

    if (pontos > SEMENTE.length * 2) {
      console.error(`\nPARE: o histórico já tem ${pontos} pontos coletados.`);
      console.error('Rodar este script apagaria tudo isso.');
      console.error('Se é mesmo o que você quer, rode com --forcar no final.\n');
      process.exit(1);
    }
  } catch { /* arquivo ilegível: pode sobrescrever */ }
}

const series = {};
const produtos = {};

if (!VAZIO) {
  for (const s of SEMENTE) {
    series[s.produto] = {};
    produtos[s.produto] = {};
    for (const regiao of s.regioes) {
      series[s.produto][regiao] = { d: [DATA_SEMENTE], v: [s.preco] };
      produtos[s.produto][regiao] = {
        preco: s.preco,
        data: DATA_SEMENTE,
        praca: s.praca,
        escopo: s.escopo,
        fonte: 'CEPEA/ESALQ-USP'
      };
    }
  }
}

const total = Object.values(produtos).reduce((n, r) => n + Object.keys(r).length, 0);

writeFileSync(caminhoHist, JSON.stringify({ series }, null, 1), 'utf8');

writeFileSync(caminhoPrec, JSON.stringify({
  atualizado_em: new Date().toISOString(),
  origem: total ? 'real' : 'vazio',
  fontes: total ? ['CEPEA/ESALQ-USP'] : [],
  contagem: { total, reais: total, exemplo: 0 },
  moedas: {},
  produtos
}, null, 1), 'utf8');

console.log(VAZIO
  ? 'Histórico zerado. Rode agora: node scripts/atualizar-precos.mjs'
  : `Semeado com ${total} cotações reais do pregão de ${DATA_SEMENTE}.
Rode agora: node scripts/atualizar-precos.mjs`);
