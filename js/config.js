/* ============================================================
   BOM DIA AGRO — Configuração geral
   Este é o único arquivo que você precisa mexer no dia a dia.
   ============================================================ */

export const CONFIG = {
  nomeApp: 'Bom Dia Agro',
  slogan: 'O preço do seu dia, antes do café.',

  /* ----------------------------------------------------------
     LOGIN
     modo: 'local'    -> cadastro guardado no próprio navegador
                         (funciona na hora, sem configurar nada)
     modo: 'supabase' -> login de verdade, na nuvem, grátis
                         (preencha url e chave abaixo)
     ---------------------------------------------------------- */
  login: {
    modo: 'supabase',

    // Pegue em: Supabase > seu projeto > Settings > API
    supabaseUrl: '',      // ex: https://abcdefgh.supabase.co
    supabaseChave: '',    // a chave "anon public" / "publishable" (é pública mesmo)

    /* CÓDIGO DE CONVITE
       Quem for se cadastrar precisa digitar este código.
       Deixe vazio ('') para liberar o cadastro para qualquer um.

       ATENÇÃO, e isso é importante: este código é um TRINCO, não uma
       fechadura. Ele segura quem recebeu o link num grupo e tentou
       entrar — mas quem entende de navegador consegue ler o código no
       código-fonte do site. A segurança de verdade é o e-mail e a
       senha do Supabase. Não use aqui um código que sirva para
       outra coisa sua. */
    codigoConvite: 'SAFRA2026'
  },

  /* Onde o app busca os dados (arquivos da pasta /dados) */
  arquivos: {
    precos: 'dados/precos.json',
    historico: 'dados/historico.json',
    noticias: 'dados/noticias.json'
  },

  /* Cotação de moedas ao vivo (API gratuita, não precisa de senha) */
  apiMoedas: 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL'
};

/* ============================================================
   REGIÕES ATENDIDAS
   Hoje o app cobre Mato Grosso e Pará.
   Para incluir outro estado: acrescente aqui e ligue os
   indicadores em scripts/atualizar-precos.mjs.
   ============================================================ */
export const REGIOES = [
  { id: 'mt', nome: 'Mato Grosso', curto: 'MT', estados: 'Sorriso · Rondonópolis · Cuiabá · Primavera' },
  { id: 'pa', nome: 'Pará',        curto: 'PA', estados: 'Paragominas · Marabá · Santarém · Redenção' }
];

/* ============================================================
   CATEGORIAS (usadas nos filtros da tela de preços)
   ============================================================ */
export const CATEGORIAS = [
  { id: 'todos',    nome: 'Todos' },
  { id: 'graos',    nome: 'Grãos' },
  { id: 'pecuaria', nome: 'Pecuária' },
  { id: 'outros',   nome: 'Outros' }
];

/* ============================================================
   CULTURAS / PRODUTOS

   'regioes' = em quais estados aquele produto aparece.
   Só entram produtos que têm cotação REAL de fonte pública.
   Nada aqui é simulado.
   ============================================================ */
export const PRODUTOS = [
  { id: 'boi-gordo',    nome: 'Boi Gordo',    unidade: 'arroba',    unidadeCurta: '@',  categoria: 'pecuaria', icone: 'boi',     regioes: ['mt', 'pa'] },
  { id: 'soja',         nome: 'Soja',         unidade: 'saca 60kg', unidadeCurta: 'sc', categoria: 'graos',    icone: 'soja',    regioes: ['mt', 'pa'] },
  { id: 'milho',        nome: 'Milho',        unidade: 'saca 60kg', unidadeCurta: 'sc', categoria: 'graos',    icone: 'milho',   regioes: ['mt', 'pa'] },
  { id: 'algodao',      nome: 'Algodão',      unidade: 'arroba',    unidadeCurta: '@',  categoria: 'outros',   icone: 'algodao', regioes: ['mt'] },
  { id: 'bezerro',      nome: 'Bezerro',      unidade: 'cabeça',    unidadeCurta: 'cab',categoria: 'pecuaria', icone: 'bezerro', regioes: ['mt'] },
  { id: 'suino',        nome: 'Suíno',        unidade: 'quilo',     unidadeCurta: 'kg', categoria: 'pecuaria', icone: 'suino',   regioes: ['mt'] },
  { id: 'frango',       nome: 'Frango',       unidade: 'quilo',     unidadeCurta: 'kg', categoria: 'pecuaria', icone: 'frango',  regioes: ['mt', 'pa'] },
  { id: 'cafe-conilon', nome: 'Café Conilon', unidade: 'saca 60kg', unidadeCurta: 'sc', categoria: 'outros',   icone: 'cafe',    regioes: ['pa'] }
];

/* Busca rápida por id */
export const PRODUTO_POR_ID = Object.fromEntries(PRODUTOS.map(p => [p.id, p]));
export const REGIAO_POR_ID  = Object.fromEntries(REGIOES.map(r => [r.id, r]));
