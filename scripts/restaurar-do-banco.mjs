/* ============================================================
   RESTAURAR DO BANCO — Bom Dia Agro

   Reconstrói dados/historico.json e dados/precos.json a partir do
   que está guardado no Supabase.

   Para que serve: é o seguro do seguro. Se o repositório sumir, se
   alguém apagar um arquivo sem querer, ou se você quiser recomeçar
   o projeto do zero noutra máquina, o histórico inteiro volta com
   um comando só. É por isso que a cópia na nuvem existe.

   COMO USAR (no Windows, no Prompt de Comando):

     set SUPABASE_URL=https://xxxxx.supabase.co
     set SUPABASE_SERVICE_KEY=sua-chave-service-role
     node scripts/restaurar-do-banco.mjs

   No Git Bash ou no Linux, troque "set" por "export".

   >>> A chave service_role é a chave-mestra do seu banco.
   >>> Use só aqui e nos Secrets do GitHub. Nunca dentro do site,
   >>> nunca num arquivo que vá para o GitHub.
   ============================================================ */

import { writeFileSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Nuvem from './nuvem.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DADOS = join(AQUI, '..', 'dados');

if (!Nuvem.ligado()) {
  console.error(`
Faltam as chaves do banco.

No Prompt de Comando do Windows:
  set SUPABASE_URL=https://xxxxx.supabase.co
  set SUPABASE_SERVICE_KEY=sua-chave-service-role
  node scripts/restaurar-do-banco.mjs
`);
  process.exit(1);
}

console.log('\nBuscando o histórico no banco...\n');

const linhas = await Nuvem.lerTudo();

if (!linhas.length) {
  console.error('O banco está vazio. Nada para restaurar.');
  console.error('Rode antes: node scripts/atualizar-precos.mjs (com as chaves ligadas)');
  process.exit(1);
}

/* --- monta as séries --- */
const series = {};
const produtos = {};

for (const l of linhas) {
  series[l.produto] ??= {};
  series[l.produto][l.regiao] ??= { d: [], v: [] };
  series[l.produto][l.regiao].d.push(l.data);
  series[l.produto][l.regiao].v.push(Number(l.preco));

  // a última linha de cada produto/estado vira o preço de hoje
  produtos[l.produto] ??= {};
  produtos[l.produto][l.regiao] = {
    preco: Number(l.preco),
    data: l.data,
    praca: l.praca,
    escopo: l.escopo,
    fonte: l.fonte
  };
}

/* --- guarda o que já existia, por segurança --- */
for (const arquivo of ['historico.json', 'precos.json']) {
  const caminho = join(DADOS, arquivo);
  if (existsSync(caminho)) {
    copyFileSync(caminho, caminho + '.antigo');
    console.log(`  cópia de segurança: dados/${arquivo}.antigo`);
  }
}

/* --- preserva as moedas do arquivo atual (não ficam no banco) --- */
let moedas = {};
try {
  moedas = JSON.parse(readFileSync(join(DADOS, 'precos.json'), 'utf8')).moedas || {};
} catch { /* sem problema */ }

const cotacoes = Object.values(produtos).reduce((n, r) => n + Object.keys(r).length, 0);

writeFileSync(join(DADOS, 'historico.json'), JSON.stringify({ series }, null, 1), 'utf8');
writeFileSync(join(DADOS, 'precos.json'), JSON.stringify({
  atualizado_em: new Date().toISOString(),
  origem: 'real',
  fontes: ['CEPEA/ESALQ-USP'],
  contagem: { total: cotacoes, reais: cotacoes, exemplo: 0 },
  restaurado_do_banco_em: new Date().toISOString(),
  moedas,
  produtos
}, null, 1), 'utf8');

console.log(`\nRestaurado com sucesso!`);
console.log(`  ${linhas.length} linhas do banco`);
console.log(`  ${cotacoes} cotações de hoje\n`);

for (const [produto, porRegiao] of Object.entries(series))
  for (const [regiao, s] of Object.entries(porRegiao))
    console.log(`  ${produto}/${regiao}: ${s.d.length} pontos (${s.d[0]} a ${s.d[s.d.length - 1]})`);

console.log('\nConfira o app e depois envie com: git add -A && git commit -m "restaura historico" && git push\n');
