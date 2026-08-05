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
   REGIÕES DO BRASIL
   ============================================================ */
export const REGIOES = [
  { id: 'centro-oeste', nome: 'Centro-Oeste', curto: 'C-Oeste', estados: 'MT · MS · GO · DF' },
  { id: 'sul',          nome: 'Sul',          curto: 'Sul',     estados: 'PR · SC · RS' },
  { id: 'sudeste',      nome: 'Sudeste',      curto: 'Sudeste', estados: 'SP · MG · ES · RJ' },
  { id: 'nordeste',     nome: 'Nordeste',     curto: 'Nordeste',estados: 'BA · MA · PI · PE' },
  { id: 'norte',        nome: 'Norte',        curto: 'Norte',   estados: 'PA · TO · RO · AM' }
];

/* ============================================================
   CATEGORIAS (usadas nos filtros da tela de preços)
   ============================================================ */
export const CATEGORIAS = [
  { id: 'todos',    nome: 'Todos' },
  { id: 'graos',    nome: 'Grãos' },
  { id: 'pecuaria', nome: 'Pecuária' },
  { id: 'cafe',     nome: 'Café' },
  { id: 'outros',   nome: 'Outros' }
];

/* ============================================================
   CULTURAS / PRODUTOS
   'regioes' = onde aquele produto costuma ter praça de negócio
   ============================================================ */
export const PRODUTOS = [
  { id: 'boi-gordo',    nome: 'Boi Gordo',     unidade: 'arroba',      unidadeCurta: '@',        categoria: 'pecuaria', icone: 'boi',     regioes: ['centro-oeste','sudeste','sul','norte','nordeste'] },
  { id: 'soja',         nome: 'Soja',          unidade: 'saca 60kg',   unidadeCurta: 'sc',       categoria: 'graos',    icone: 'soja',    regioes: ['centro-oeste','sul','sudeste','nordeste','norte'] },
  { id: 'milho',        nome: 'Milho',         unidade: 'saca 60kg',   unidadeCurta: 'sc',       categoria: 'graos',    icone: 'milho',   regioes: ['centro-oeste','sul','sudeste','nordeste','norte'] },
  { id: 'cafe-arabica', nome: 'Café Arábica',  unidade: 'saca 60kg',   unidadeCurta: 'sc',       categoria: 'cafe',     icone: 'cafe',    regioes: ['sudeste','sul'] },
  { id: 'cafe-conilon', nome: 'Café Conilon',  unidade: 'saca 60kg',   unidadeCurta: 'sc',       categoria: 'cafe',     icone: 'cafe',    regioes: ['sudeste','norte'] },
  { id: 'algodao',      nome: 'Algodão',       unidade: 'arroba',      unidadeCurta: '@',        categoria: 'outros',   icone: 'algodao', regioes: ['centro-oeste','nordeste','sudeste'] },
  { id: 'trigo',        nome: 'Trigo',         unidade: 'saca 60kg',   unidadeCurta: 'sc',       categoria: 'graos',    icone: 'trigo',   regioes: ['sul','sudeste','centro-oeste'] },
  { id: 'arroz',        nome: 'Arroz',         unidade: 'saca 50kg',   unidadeCurta: 'sc',       categoria: 'graos',    icone: 'arroz',   regioes: ['sul','centro-oeste','norte'] },
  { id: 'feijao',       nome: 'Feijão Carioca',unidade: 'saca 60kg',   unidadeCurta: 'sc',       categoria: 'graos',    icone: 'feijao',  regioes: ['sudeste','centro-oeste','sul','nordeste'] },
  { id: 'sorgo',        nome: 'Sorgo',         unidade: 'saca 60kg',   unidadeCurta: 'sc',       categoria: 'graos',    icone: 'sorgo',   regioes: ['centro-oeste','sudeste','nordeste'] },
  { id: 'bezerro',      nome: 'Bezerro',       unidade: 'cabeça',      unidadeCurta: 'cab',      categoria: 'pecuaria', icone: 'bezerro', regioes: ['centro-oeste','sudeste','sul','norte'] },
  { id: 'vaca-gorda',   nome: 'Vaca Gorda',    unidade: 'arroba',      unidadeCurta: '@',        categoria: 'pecuaria', icone: 'vaca',    regioes: ['centro-oeste','sudeste','sul','norte'] },
  { id: 'suino',        nome: 'Suíno Vivo',    unidade: 'quilo',       unidadeCurta: 'kg',       categoria: 'pecuaria', icone: 'suino',   regioes: ['sul','sudeste','centro-oeste'] },
  { id: 'frango',       nome: 'Frango Vivo',   unidade: 'quilo',       unidadeCurta: 'kg',       categoria: 'pecuaria', icone: 'frango',  regioes: ['sul','sudeste','centro-oeste','nordeste'] },
  { id: 'ovos',         nome: 'Ovos',          unidade: 'caixa 30dz',  unidadeCurta: 'cx',       categoria: 'pecuaria', icone: 'ovo',     regioes: ['sudeste','sul','centro-oeste','nordeste'] },
  { id: 'leite',        nome: 'Leite',         unidade: 'litro',       unidadeCurta: 'L',        categoria: 'pecuaria', icone: 'leite',   regioes: ['sudeste','sul','centro-oeste','nordeste'] },
  { id: 'acucar',       nome: 'Açúcar Cristal',unidade: 'saca 50kg',   unidadeCurta: 'sc',       categoria: 'outros',   icone: 'cana',    regioes: ['sudeste','nordeste','centro-oeste'] },
  { id: 'mandioca',     nome: 'Mandioca',      unidade: 'tonelada',    unidadeCurta: 't',        categoria: 'outros',   icone: 'feijao',  regioes: ['sul','sudeste','nordeste'] },
  { id: 'laranja',      nome: 'Laranja',       unidade: 'caixa 40,8kg',unidadeCurta: 'cx',       categoria: 'outros',   icone: 'laranja', regioes: ['sudeste','sul'] }
];

/* Busca rápida por id */
export const PRODUTO_POR_ID = Object.fromEntries(PRODUTOS.map(p => [p.id, p]));
export const REGIAO_POR_ID  = Object.fromEntries(REGIOES.map(r => [r.id, r]));
