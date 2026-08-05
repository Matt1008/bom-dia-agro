/* ============================================================
   SERVIDOR LOCAL — para testar o app no seu computador

   Como usar:
     1. Abra o Prompt de Comando na pasta do projeto
     2. Digite:  node scripts/servidor.mjs
     3. Abra no navegador:  http://localhost:3000

   Para parar: aperte Ctrl + C na janela preta.

   (Por que precisa disso? O navegador bloqueia a leitura de
    arquivos JSON quando você abre o index.html com dois cliques.
    Este servidorzinho resolve. Não precisa instalar nada.)
   ============================================================ */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = process.env.PORT || 3000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon'
};

const servidor = createServer(async (req, res) => {
  try {
    let caminho = decodeURIComponent(req.url.split('?')[0]);
    if (caminho === '/') caminho = '/index.html';

    // impede sair da pasta do projeto (../../etc)
    const alvo = join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
    if (!alvo.startsWith(RAIZ)) {
      res.writeHead(403).end('Acesso negado');
      return;
    }

    const info = await stat(alvo);
    if (!info.isFile()) throw new Error('não é arquivo');

    const conteudo = await readFile(alvo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(conteudo);

  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>Arquivo não encontrado.</p>');
  }
});

servidor.listen(PORTA, () => {
  console.log(`\n  Bom Dia Agro rodando!`);
  console.log(`  Abra no navegador:  http://localhost:${PORTA}\n`);
  console.log(`  (para parar, aperte Ctrl + C)\n`);
});
