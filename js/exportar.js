/* ============================================================
   EXPORTAR — PDF, texto para o WhatsApp e imagem (print pronto)
   ============================================================ */

import { REGIAO_POR_ID, PRODUTO_POR_ID } from './config.js';
import { BANCO, dinheiro, porcento, casasDe, ESCOPOS } from './dados.js';

const AVISO_CURTO = 'Valores de referência. Confirme com seu comprador antes de negociar.';

function montarLinhas(itens) {
  return itens.map(it => {
    const p = PRODUTO_POR_ID[it.produtoId];
    return {
      nome: p.nome,
      unidade: p.unidadeCurta,
      praca: it.praca,
      escopo: it.escopo,
      preco: it.preco,
      precoTexto: dinheiro(it.preco, casasDe(it.produtoId)),
      pctTexto: it.variacao ? porcento(it.variacao.pct) : '—',
      direcao: it.variacao?.direcao || null
    };
  });
}

function hojeTexto() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* Nota de rodapé explicando os escopos que aparecem na lista */
function notaEscopos(linhas) {
  const usados = [...new Set(linhas.map(l => l.escopo).filter(Boolean))];
  const partes = [];
  if (usados.includes('nacional')) partes.push('Indicador nacional = referência do Brasil; na porteira varia com frete e prazo.');
  if (usados.includes('porto'))    partes.push('Preço de porto = valor em Paranaguá; desconte o frete até lá.');
  if (usados.includes('vizinho'))  partes.push('Estado vizinho = não há cotação pública no estado; usamos o mercado publicado mais próximo.');
  return partes.join(' ');
}

function fonteTexto() {
  return BANCO.precos?.fontes?.length ? BANCO.precos.fontes.join(', ') : null;
}

/* ============================================================
   1) TEXTO PARA O WHATSAPP
   ============================================================ */
export function textoWhatsApp(itens, regiaoId) {
  const regiao = REGIAO_POR_ID[regiaoId];
  const linhas = montarLinhas(itens);

  const bolinha = d => d === 'sobe' ? '🟢' : d === 'desce' ? '🔴' : d === 'igual' ? '⚪' : '▫️';

  let t = `*☀️ BOM DIA AGRO*\n`;
  t += `_${regiao?.nome || 'Brasil'} · ${hojeTexto()}_\n`;
  t += `─────────────────\n`;

  linhas.forEach(l => {
    t += `${bolinha(l.direcao)} *${l.nome}*\n`;
    t += `    ${l.precoTexto} /${l.unidade}   (${l.pctTexto})\n`;
  });

  t += `─────────────────\n`;
  const fonte = fonteTexto();
  if (fonte) t += `Fonte: ${fonte}\n`;
  const nota = notaEscopos(linhas);
  if (nota) t += `${nota}\n`;
  t += `${AVISO_CURTO}\n`;
  t += `\n_Bom Dia Agro — o preço do seu dia, antes do café._`;
  return t;
}

export function abrirWhatsApp(itens, regiaoId) {
  window.open('https://wa.me/?text=' + encodeURIComponent(textoWhatsApp(itens, regiaoId)), '_blank', 'noopener');
}

export async function copiarTexto(itens, regiaoId) {
  const texto = textoWhatsApp(itens, regiaoId);
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(t);
    return ok;
  }
}

/* ============================================================
   2) PDF — monta uma folha limpa e chama a impressão do navegador
      (no diálogo, o usuário escolhe "Salvar como PDF")
   ============================================================ */
export function gerarPDF(itens, regiaoId) {
  const regiao = REGIAO_POR_ID[regiaoId];
  const linhas = montarLinhas(itens);
  const folha = document.getElementById('folha-pdf');
  const fonte = fonteTexto();

  folha.innerHTML = `
    <div class="pdf-cab">
      <h1><span class="b">Bom Dia</span> <span class="a">Agro</span></h1>
      <div class="sub"><b>${regiao?.nome || 'Brasil'}</b> — ${regiao?.estados || ''} &nbsp;·&nbsp; ${hojeTexto()}</div>
    </div>
    <table class="pdf-tabela">
      <thead><tr>
        <th>Produto</th><th>Cotação de referência</th><th class="n">Unidade</th>
        <th class="n">Preço</th><th class="n">Variação</th>
      </tr></thead>
      <tbody>
        ${linhas.map(l => `<tr>
          <td><b>${l.nome}</b></td>
          <td>${l.praca || '—'}</td>
          <td class="n">${l.unidade}</td>
          <td class="n"><b>${l.precoTexto}</b></td>
          <td class="n ${l.direcao || ''}">${l.pctTexto}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="pdf-rodape">
      ${fonte ? `<b>Fonte: ${fonte}.</b><br>` : ''}
      ${notaEscopos(linhas)}<br>
      ${AVISO_CURTO}<br>
      Gerado pelo Bom Dia Agro em ${new Date().toLocaleString('pt-BR')}.
    </div>`;

  const tituloAntigo = document.title;
  document.title = `Bom Dia Agro - ${regiao?.nome || 'Brasil'} - ${new Date().toISOString().slice(0, 10)}`;
  window.print();
  setTimeout(() => { document.title = tituloAntigo; }, 800);
}

/* ============================================================
   3) IMAGEM — desenha um "print" bonito no canvas.
      No celular abre o menu de compartilhar (WhatsApp direto).
      No PC baixa o PNG.
   ============================================================ */
export async function gerarImagem(itens, regiaoId, temaEscuro = false) {
  const regiao = REGIAO_POR_ID[regiaoId];
  const linhas = montarLinhas(itens);
  const fonte = fonteTexto();

  const E = 2;                      // escala (deixa a imagem nítida)
  const LARG = 620;
  const alturaLinha = 62;
  const topo = 148;
  const rodape = 78;
  const ALT = topo + linhas.length * alturaLinha + rodape;

  const c = document.createElement('canvas');
  c.width = LARG * E; c.height = ALT * E;
  const x = c.getContext('2d');
  x.scale(E, E);

  const cores = temaEscuro
    ? { fundo: '#0F1613', cartao: '#18211D', tinta: '#ECEFEB', tinta3: '#74807A', linha: '#2A3630', verde: '#4FB477', ambar: '#E0A055', alta: '#4FB477', baixa: '#E4695B' }
    : { fundo: '#F7F6F1', cartao: '#FFFFFF', tinta: '#1C2320', tinta3: '#8B968F', linha: '#E1DFD4', verde: '#17743C', ambar: '#C6802E', alta: '#17743C', baixa: '#C0392B' };

  const F = (peso, tam) => `${peso} ${tam}px "Segoe UI", system-ui, Arial, sans-serif`;

  /* fundo */
  x.fillStyle = cores.fundo;
  x.fillRect(0, 0, LARG, ALT);

  /* faixa do amanhecer */
  const faixa = x.createLinearGradient(0, 0, LARG, 0);
  faixa.addColorStop(0, cores.ambar);
  faixa.addColorStop(1, cores.verde);
  x.fillStyle = faixa;
  x.fillRect(0, 0, LARG, 7);

  /* cabeçalho */
  x.textBaseline = 'alphabetic';
  x.font = F(800, 34);
  x.fillStyle = cores.ambar; x.fillText('Bom Dia', 30, 62);
  const larguraBomDia = x.measureText('Bom Dia ').width;
  x.fillStyle = cores.verde;  x.fillText('Agro', 30 + larguraBomDia, 62);

  x.font = F(700, 17);
  x.fillStyle = cores.tinta;
  x.fillText(regiao?.nome || 'Brasil', 30, 92);

  x.font = F(400, 14);
  x.fillStyle = cores.tinta3;
  x.fillText(`${regiao?.estados || ''}  ·  ${hojeTexto()}`, 30, 113);

  /* linha divisória */
  x.strokeStyle = cores.linha; x.lineWidth = 1;
  x.beginPath(); x.moveTo(30, topo - 22); x.lineTo(LARG - 30, topo - 22); x.stroke();

  /* linhas de produto */
  linhas.forEach((l, i) => {
    const y = topo + i * alturaLinha;

    if (i % 2 === 0) {
      x.fillStyle = cores.cartao;
      arredondado(x, 22, y - 20, LARG - 44, alturaLinha - 8, 12);
      x.fill();
    }

    x.font = F(700, 17);
    x.fillStyle = cores.tinta;
    x.fillText(l.nome, 34, y);

    x.font = F(400, 12.5);
    x.fillStyle = cores.tinta3;
    x.fillText(`${l.praca || ''} · por ${l.unidade}`, 34, y + 19);

    x.textAlign = 'right';
    x.font = F(800, 21);
    x.fillStyle = cores.tinta;
    x.fillText(l.precoTexto, LARG - 34, y + 2);

    const cor = l.direcao === 'sobe' ? cores.alta : l.direcao === 'desce' ? cores.baixa : cores.tinta3;
    const flecha = l.direcao === 'sobe' ? '▲' : l.direcao === 'desce' ? '▼' : '';
    x.font = F(700, 13.5);
    x.fillStyle = cor;
    x.fillText(`${flecha} ${l.pctTexto}`.trim(), LARG - 34, y + 21);
    x.textAlign = 'left';
  });

  /* rodapé */
  const yR = topo + linhas.length * alturaLinha + 14;
  x.font = F(400, 11.5);
  x.fillStyle = cores.tinta3;
  x.fillText((fonte ? `Fonte: ${fonte}. ` : '') + AVISO_CURTO, 30, yR);
  x.fillText('Bom Dia Agro — o preço do seu dia, antes do café.', 30, yR + 17);

  /* --- vira arquivo --- */
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const nome = `bom-dia-agro-${regiaoId}-${new Date().toISOString().slice(0, 10)}.png`;
  const arquivo = new File([blob], nome, { type: 'image/png' });

  // Celular: abre o menu nativo (WhatsApp, Telegram, e-mail...)
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Bom Dia Agro' });
      return 'compartilhado';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelado';
    }
  }

  // PC: baixa o PNG
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'baixado';
}

/* retângulo com cantos arredondados (compatível com navegadores antigos) */
function arredondado(x, px, py, larg, alt, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.lineTo(px + larg - r, py);       x.quadraticCurveTo(px + larg, py, px + larg, py + r);
  x.lineTo(px + larg, py + alt - r); x.quadraticCurveTo(px + larg, py + alt, px + larg - r, py + alt);
  x.lineTo(px + r, py + alt);        x.quadraticCurveTo(px, py + alt, px, py + alt - r);
  x.lineTo(px, py + r);              x.quadraticCurveTo(px, py, px + r, py);
  x.closePath();
}
