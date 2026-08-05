/* ============================================================
   LOGIN E CADASTRO

   Dois modos (escolhidos em js/config.js):

   'local'    — funciona na hora, sem configurar nada. O cadastro
                fica guardado só NAQUELE aparelho. Serve para testar
                e para uso entre amigos de confiança.
                NÃO é segurança de verdade: quem souber mexer no
                navegador consegue ver os dados. Nunca use uma senha
                importante aqui.

   'supabase' — login de verdade, na nuvem, de graça. A senha nunca
                fica no aparelho e o mesmo cadastro funciona em
                qualquer celular ou PC.
   ============================================================ */

import { CONFIG } from './config.js';

const CHAVE_USUARIOS = 'bda_usuarios';
const CHAVE_SESSAO   = 'bda_sessao';

/* ------------------------------------------------------------
   Ferramentas
   ------------------------------------------------------------ */
async function embaralhar(texto) {
  const dados = new TextEncoder().encode('bom-dia-agro::' + texto);
  const hash = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function ler(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; }
  catch { return padrao; }
}
function gravar(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

export function validarEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e || '').trim());
}

const usandoSupabase = () =>
  CONFIG.login.modo === 'supabase' && CONFIG.login.supabaseUrl && CONFIG.login.supabaseChave;

/** 'supabase' (nuvem) ou 'local' (só neste aparelho) */
export function modoAtual() {
  return usandoSupabase() ? 'supabase' : 'local';
}

/** Pediu login na nuvem, mas ainda falta preencher a URL/chave? */
export function faltaConfigurarNuvem() {
  return CONFIG.login.modo === 'supabase' && !usandoSupabase();
}

/* ------------------------------------------------------------
   SUPABASE (chamado pela API direta, sem baixar biblioteca)
   ------------------------------------------------------------ */
async function chamarSupabase(rota, corpo) {
  const r = await fetch(`${CONFIG.login.supabaseUrl}/auth/v1/${rota}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.login.supabaseChave,
      // as chaves novas (sb_publishable_...) exigem também este cabeçalho
      'Authorization': `Bearer ${CONFIG.login.supabaseChave}`
    },
    body: JSON.stringify(corpo)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = d.error_description || d.msg || d.message || 'Não consegui conectar.';
    throw new Error(traduzir(msg));
  }
  return d;
}

function traduzir(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem cadastro. É só entrar.';
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere um minutinho.';
  return msg;
}

/* ------------------------------------------------------------
   CADASTRAR
   ------------------------------------------------------------ */
/** O cadastro está pedindo código de convite? */
export function exigeConvite() {
  return !!(CONFIG.login.codigoConvite || '').trim();
}

export async function cadastrar(nome, email, senha, convite) {
  nome = (nome || '').trim();
  email = (email || '').trim().toLowerCase();

  if (nome.length < 2)       throw new Error('Escreva seu nome.');
  if (!validarEmail(email))  throw new Error('Esse e-mail não parece certo.');
  if ((senha || '').length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');

  if (exigeConvite()) {
    const esperado = CONFIG.login.codigoConvite.trim().toUpperCase();
    const digitado = (convite || '').trim().toUpperCase();
    if (!digitado)            throw new Error('Digite o código de convite.');
    if (digitado !== esperado) throw new Error('Código de convite incorreto. Peça o código a quem te indicou o app.');
  }

  if (usandoSupabase()) {
    const d = await chamarSupabase('signup', { email, password: senha, data: { nome } });
    if (d.access_token) {
      const usuario = { nome, email, token: d.access_token };
      gravar(CHAVE_SESSAO, usuario);
      return { usuario, precisaConfirmarEmail: false };
    }
    return { usuario: null, precisaConfirmarEmail: true };
  }

  const usuarios = ler(CHAVE_USUARIOS, {});
  if (usuarios[email]) throw new Error('Este e-mail já tem cadastro. É só entrar.');

  usuarios[email] = { nome, email, senha: await embaralhar(senha), criado: new Date().toISOString() };
  gravar(CHAVE_USUARIOS, usuarios);

  const usuario = { nome, email };
  gravar(CHAVE_SESSAO, usuario);
  return { usuario, precisaConfirmarEmail: false };
}

/* ------------------------------------------------------------
   ENTRAR
   ------------------------------------------------------------ */
export async function entrar(email, senha) {
  email = (email || '').trim().toLowerCase();
  if (!validarEmail(email)) throw new Error('Esse e-mail não parece certo.');
  if (!senha)               throw new Error('Digite sua senha.');

  if (usandoSupabase()) {
    const d = await chamarSupabase('token?grant_type=password', { email, password: senha });
    const usuario = {
      nome: d.user?.user_metadata?.nome || email.split('@')[0],
      email,
      token: d.access_token
    };
    gravar(CHAVE_SESSAO, usuario);
    return usuario;
  }

  const usuarios = ler(CHAVE_USUARIOS, {});
  const achado = usuarios[email];
  if (!achado) throw new Error('Não encontrei esse e-mail. Faça seu cadastro primeiro.');
  if (achado.senha !== await embaralhar(senha)) throw new Error('Senha incorreta.');

  const usuario = { nome: achado.nome, email };
  gravar(CHAVE_SESSAO, usuario);
  return usuario;
}

/* ------------------------------------------------------------
   SESSÃO
   ------------------------------------------------------------ */
export function usuarioAtual() {
  return ler(CHAVE_SESSAO, null);
}

export function sair() {
  localStorage.removeItem(CHAVE_SESSAO);
}

/** Primeiro nome, para a saudação */
export function primeiroNome(usuario) {
  return (usuario?.nome || '').trim().split(/\s+/)[0] || 'produtor';
}
