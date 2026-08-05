/* ============================================================
   GERADOR DE DADOS DE EXEMPLO — Bom Dia Agro

   Cria dados/precos.json e dados/historico.json com valores de
   EXEMPLO, só para o app já abrir bonito e com os gráficos
   funcionando desde o primeiro minuto.

   >>> ATENÇÃO: estes números são SIMULADOS. Não servem para
   >>> decisão de compra ou venda. Quando você ligar a
   >>> atualização automática (scripts/atualizar-precos.mjs),
   >>> eles vão sendo substituídos por cotações reais.

   Como rodar:   node scripts/gerar-dados-exemplo.mjs
   ============================================================ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA_DADOS = join(AQUI, '..', 'dados');

const DIAS = 366; // um ano de histórico

/* --- Sorteio "com semente": sempre gera o mesmo resultado --- */
function semente(txt) {
  let h = 1779033703 ^ txt.length;
  for (let i = 0; i < txt.length; i++) {
    h = Math.imul(h ^ txt.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/* --- Catálogo: preço-base, volatilidade e praças por região --- */
const CATALOGO = {
  'boi-gordo':    { base: 322,   vol: .006, dec: 2, pracas: { 'centro-oeste':'Cuiabá/MT','sudeste':'Araçatuba/SP','sul':'Cascavel/PR','norte':'Marabá/PA','nordeste':'Barreiras/BA' } },
  'soja':         { base: 138,   vol: .008, dec: 2, pracas: { 'centro-oeste':'Sorriso/MT','sul':'Passo Fundo/RS','sudeste':'Uberlândia/MG','nordeste':'L. E. Magalhães/BA','norte':'Santarém/PA' } },
  'milho':        { base: 71,    vol: .009, dec: 2, pracas: { 'centro-oeste':'Rio Verde/GO','sul':'Cascavel/PR','sudeste':'Campinas/SP','nordeste':'Barreiras/BA','norte':'Paragominas/PA' } },
  'cafe-arabica': { base: 2280,  vol: .012, dec: 2, pracas: { 'sudeste':'Guaxupé/MG','sul':'Londrina/PR' } },
  'cafe-conilon': { base: 1450,  vol: .011, dec: 2, pracas: { 'sudeste':'Colatina/ES','norte':'Ji-Paraná/RO' } },
  'algodao':      { base: 165,   vol: .009, dec: 2, pracas: { 'centro-oeste':'Primavera do Leste/MT','nordeste':'L. E. Magalhães/BA','sudeste':'Ituverava/SP' } },
  'trigo':        { base: 82,    vol: .008, dec: 2, pracas: { 'sul':'Passo Fundo/RS','sudeste':'Itapeva/SP','centro-oeste':'Cristalina/GO' } },
  'arroz':        { base: 118,   vol: .010, dec: 2, pracas: { 'sul':'Pelotas/RS','centro-oeste':'Formoso/TO','norte':'Santarém/PA' } },
  'feijao':       { base: 285,   vol: .018, dec: 2, pracas: { 'sudeste':'Irecê/MG','centro-oeste':'Cristalina/GO','sul':'Ponta Grossa/PR','nordeste':'Irecê/BA' } },
  'sorgo':        { base: 58,    vol: .010, dec: 2, pracas: { 'centro-oeste':'Rio Verde/GO','sudeste':'Uberaba/MG','nordeste':'Barreiras/BA' } },
  'bezerro':      { base: 2650,  vol: .007, dec: 0, pracas: { 'centro-oeste':'Campo Grande/MS','sudeste':'S. J. Rio Preto/SP','sul':'Guarapuava/PR','norte':'Redenção/PA' } },
  'vaca-gorda':   { base: 292,   vol: .007, dec: 2, pracas: { 'centro-oeste':'Cuiabá/MT','sudeste':'Araçatuba/SP','sul':'Cascavel/PR','norte':'Marabá/PA' } },
  'suino':        { base: 8.40,  vol: .010, dec: 2, pracas: { 'sul':'Chapecó/SC','sudeste':'Ponte Nova/MG','centro-oeste':'Rio Verde/GO' } },
  'frango':       { base: 6.20,  vol: .008, dec: 2, pracas: { 'sul':'Cascavel/PR','sudeste':'Bastos/SP','centro-oeste':'Rio Verde/GO','nordeste':'Recife/PE' } },
  'ovos':         { base: 195,   vol: .014, dec: 2, pracas: { 'sudeste':'Bastos/SP','sul':'Cascavel/PR','centro-oeste':'Itumbiara/GO','nordeste':'Recife/PE' } },
  'leite':        { base: 2.65,  vol: .004, dec: 4, pracas: { 'sudeste':'Média MG','sul':'Média PR','centro-oeste':'Média GO','nordeste':'Média BA' } },
  'acucar':       { base: 95,    vol: .006, dec: 2, pracas: { 'sudeste':'Ribeirão Preto/SP','nordeste':'Zona da Mata/PE','centro-oeste':'Goianésia/GO' } },
  'mandioca':     { base: 510,   vol: .009, dec: 2, pracas: { 'sul':'Paranavaí/PR','sudeste':'Presidente Prudente/SP','nordeste':'Cruz das Almas/BA' } },
  'laranja':      { base: 34,    vol: .016, dec: 2, pracas: { 'sudeste':'Bebedouro/SP','sul':'Paranavaí/PR' } }
};

/* --- Diferença de preço entre regiões (frete, logística, prêmio) --- */
const AJUSTE_REGIAO = {
  'centro-oeste': 0.96, 'sul': 1.03, 'sudeste': 1.00, 'nordeste': 0.98, 'norte': 0.93
};

function arredonda(v, casas) { return Number(v.toFixed(casas)); }

/* ------------------------------------------------------------
   1) Monta a lista de datas (só dias úteis, como no mercado real)
   ------------------------------------------------------------ */
const datas = [];
const hoje = new Date();
hoje.setHours(12, 0, 0, 0);
for (let i = DIAS - 1; i >= 0; i--) {
  const d = new Date(hoje);
  d.setDate(d.getDate() - i);
  const semana = d.getDay();
  if (semana === 0 || semana === 6) continue; // pula sábado e domingo
  datas.push(d.toISOString().slice(0, 10));
}

/* ------------------------------------------------------------
   2) Gera a série de cada produto em cada região
   ------------------------------------------------------------ */
const series = {};
const precos = {};

for (const [produtoId, info] of Object.entries(CATALOGO)) {
  series[produtoId] = {};
  precos[produtoId] = {};

  for (const [regiaoId, praca] of Object.entries(info.pracas)) {
    const sorteia = semente(produtoId + '|' + regiaoId);
    const partida = info.base * (AJUSTE_REGIAO[regiaoId] ?? 1);

    // tendência suave de longo prazo + ciclo de safra + ruído do dia
    const tendencia = (sorteia() - 0.45) * 0.22;   // -10% a +12% no ano
    const amplitudeSafra = 0.04 + sorteia() * 0.07;
    const faseSafra = sorteia() * Math.PI * 2;

    let ruido = 0;
    const valores = [];

    datas.forEach((_, i) => {
      const t = i / (datas.length - 1);
      ruido += (sorteia() - 0.5) * info.vol * 2;
      ruido *= 0.94; // o ruído volta pra média (mercado não dispara sozinho)
      const safra = Math.sin(faseSafra + t * Math.PI * 2) * amplitudeSafra;
      const fator = 1 + tendencia * t + safra + ruido;
      valores.push(arredonda(partida * fator, info.dec));
    });

    series[produtoId][regiaoId] = valores;
    precos[produtoId][regiaoId] = {
      preco: valores[valores.length - 1],
      praca,
      origem: 'exemplo'   // vira 'real' quando a atualização automática encontra a cotação
    };
  }
}

/* ------------------------------------------------------------
   3) Moedas de exemplo (o app busca as reais ao vivo)
   ------------------------------------------------------------ */
const moedas = {
  USD: { nome: 'Dólar',  valor: 5.42, variacao: 0.31 },
  EUR: { nome: 'Euro',   valor: 6.18, variacao: -0.14 }
};

/* ------------------------------------------------------------
   4) Grava os arquivos
   ------------------------------------------------------------ */
mkdirSync(PASTA_DADOS, { recursive: true });

writeFileSync(join(PASTA_DADOS, 'precos.json'), JSON.stringify({
  atualizado_em: new Date().toISOString(),
  origem: 'exemplo',
  aviso: 'Valores SIMULADOS, gerados por computador apenas para demonstração. Não use para decidir compra ou venda.',
  fontes: [],
  moedas,
  produtos: precos
}, null, 1), 'utf8');

writeFileSync(join(PASTA_DADOS, 'historico.json'), JSON.stringify({
  origem: 'exemplo',
  datas,
  series
}), 'utf8');

console.log(`OK! ${datas.length} dias gerados para ${Object.keys(CATALOGO).length} produtos.`);
console.log('Arquivos criados em: dados/precos.json e dados/historico.json');
