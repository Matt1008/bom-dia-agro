/* ============================================================
   GRÁFICOS — todos desenhados à mão em SVG.
   Sem Chart.js, sem D3, sem nada baixado da internet.
   Assim o app abre mesmo com sinal fraco na fazenda.
   ============================================================ */

import { dataCurta, numero } from './dados.js';

let contador = 0;
const proximoId = () => 'g' + (++contador);

/**
 * Largura do desenho (o viewBox), não a largura na tela.
 * O SVG estica para caber na largura disponível mantendo a proporção.
 * Num celular estreito, um desenho "largo" viraria uma tirinha de 2 cm
 * de altura — então lá usamos um desenho mais quadrado.
 */
function larguraDesenho() {
  const tela = window.innerWidth || 1024;
  if (tela < 480) return 380;
  if (tela < 760) return 520;
  return 720;
}

/* ------------------------------------------------------------
   1) MINI-GRÁFICO (a linhinha que aparece dentro do cartão)
   ------------------------------------------------------------ */
export function miniGrafico(valores, largura = 62, altura = 26) {
  if (!valores || valores.length < 2) return '';

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const passo = largura / (valores.length - 1);

  const pontos = valores.map((v, i) => {
    const x = i * passo;
    const y = altura - 2 - ((v - min) / faixa) * (altura - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const subiu = valores[valores.length - 1] >= valores[0];
  const cor = subiu ? 'var(--alta)' : 'var(--baixa)';
  const id = proximoId();

  return `<svg class="mini-grafico" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cor}" stop-opacity=".22"/>
      <stop offset="100%" stop-color="${cor}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="0,${altura} ${pontos.join(' ')} ${largura},${altura}" fill="url(#${id})"/>
    <polyline points="${pontos.join(' ')}" fill="none" stroke="${cor}"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${largura}" cy="${pontos[pontos.length - 1].split(',')[1]}" r="2.4" fill="${cor}"/>
  </svg>`;
}

/* ------------------------------------------------------------
   2) GRÁFICO GRANDE DE LINHA
   opcoes = {
     series: [{ nome, valores, cor, casas, sufixo }],
     datas: ['2026-08-01', ...],
     altura: 240,
     base100: false   // true = compara dois produtos de preços bem diferentes
   }
   ------------------------------------------------------------ */
export function graficoLinha(opcoes) {
  const {
    series = [],
    datas: rotulos = [],
    altura = 250,
    base100 = false
  } = opcoes;

  const L = larguraDesenho();
  const m = { cima: 16, dir: 14, baixo: 30, esq: base100 ? 44 : 60 };
  const larguraArea = L - m.esq - m.dir;
  const alturaArea = altura - m.cima - m.baixo;

  const validas = series.filter(s => s.valores && s.valores.length >= 2);
  if (!validas.length) {
    return `<svg viewBox="0 0 ${L} ${altura}"><text x="${L / 2}" y="${altura / 2}"
      text-anchor="middle" fill="var(--tinta-3)" font-size="14"
      font-family="system-ui">Sem dados para este período</text></svg>`;
  }

  // Se for base 100, cada série vira "quanto rendeu desde o início"
  const dados = validas.map(s => ({
    ...s,
    plot: base100 ? s.valores.map(v => (v / s.valores[0]) * 100) : s.valores
  }));

  const todos = dados.flatMap(s => s.plot);
  let min = Math.min(...todos);
  let max = Math.max(...todos);
  const folga = (max - min || Math.abs(max) * 0.05 || 1) * 0.12;
  min -= folga; max += folga;
  const faixa = max - min || 1;

  const n = Math.max(...dados.map(s => s.plot.length));
  const px = i => m.esq + (n === 1 ? larguraArea / 2 : (i / (n - 1)) * larguraArea);
  const py = v => m.cima + alturaArea - ((v - min) / faixa) * alturaArea;

  /* --- linhas horizontais de referência + números da esquerda ---
     As casas decimais saem do TAMANHO DA FAIXA, não do valor.
     Sem isso, um boi variando centavos vira "350 350 351 351". */
  const RISCOS = 4;
  const passoEixo = faixa / RISCOS;
  // nunca passa de 2 casas: é dinheiro, ninguém lê "R$ 350,102"
  const casasEixo = passoEixo >= 50 ? 0 : passoEixo >= 5 ? 1 : 2;

  let grade = '';
  for (let i = 0; i <= RISCOS; i++) {
    const v = min + passoEixo * i;
    const y = py(v);
    grade += `<line x1="${m.esq}" y1="${y.toFixed(1)}" x2="${L - m.dir}" y2="${y.toFixed(1)}"
      stroke="var(--linha)" stroke-width="1" ${i === 0 ? '' : 'stroke-dasharray="3 5"'}/>`;
    grade += `<text x="${m.esq - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end"
      font-size="11" fill="var(--tinta-3)" font-family="system-ui"
      font-variant-numeric="tabular-nums">${base100 ? numero(v, 1) : formataEixo(v, casasEixo)}</text>`;
  }

  /* --- datas embaixo (menos datas em tela estreita, senão embolam) --- */
  let eixoX = '';
  const quantasDatas = Math.min(L < 450 ? 4 : 6, n);
  for (let i = 0; i < quantasDatas; i++) {
    const idx = Math.round((i / (quantasDatas - 1 || 1)) * (n - 1));
    eixoX += `<text x="${px(idx).toFixed(1)}" y="${altura - 9}" text-anchor="middle"
      font-size="11" fill="var(--tinta-3)" font-family="system-ui">${dataCurta(rotulos[idx])}</text>`;
  }

  /* --- as linhas de cada série ---
     Quando parte da série ainda é curva estimada (a coleta real
     começou depois), esse trecho sai TRACEJADO e mais apagado.
     O pedaço sólido é o que foi coletado de verdade. Assim dá para
     ver, olhando, onde termina a estimativa e começa o dado real. */
  let linhas = '';
  dados.forEach((s, k) => {
    const pts = s.plot.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
    const cor = s.cor || 'var(--verde)';
    const id = proximoId();

    // quantos pontos do fim são reais (0 = série toda estimada)
    const reais = Math.max(0, Math.min(s.reais ?? pts.length, pts.length));
    const corte = pts.length - reais;   // índice onde a parte real começa

    if (dados.length === 1 && reais === pts.length) {
      linhas += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${cor}" stop-opacity=".26"/>
        <stop offset="100%" stop-color="${cor}" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon points="${px(0).toFixed(1)},${m.cima + alturaArea} ${pts.join(' ')} ${px(n - 1).toFixed(1)},${m.cima + alturaArea}"
        fill="url(#${id})"/>`;
    }

    // trecho estimado (inclui o ponto de emenda, para não haver buraco)
    if (corte > 0) {
      linhas += `<polyline points="${pts.slice(0, Math.min(corte + 1, pts.length)).join(' ')}"
        fill="none" stroke="${cor}" stroke-width="2" stroke-dasharray="5 5"
        stroke-linecap="round" stroke-linejoin="round" opacity=".42" class="linha-estimada"/>`;
    }

    // trecho realmente coletado
    if (reais > 0) {
      const solidos = pts.slice(Math.max(0, corte));
      if (solidos.length === 1) {
        const [cx, cy] = solidos[0].split(',');
        linhas += `<circle cx="${cx}" cy="${cy}" r="3.2" fill="${cor}" class="linha-serie"/>`;
      } else {
        linhas += `<polyline points="${solidos.join(' ')}" fill="none" stroke="${cor}"
          stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="linha-serie"/>`;
      }
    }

    const ultimo = pts[pts.length - 1].split(',');
    linhas += `<circle cx="${ultimo[0]}" cy="${ultimo[1]}" r="4" fill="var(--papel-2)" stroke="${cor}" stroke-width="2.4"/>`;
  });

  /* --- camada invisível que captura o dedo/mouse --- */
  const marcador = `
    <g class="marcador" style="opacity:0; pointer-events:none">
      <line class="mk-linha" y1="${m.cima}" y2="${m.cima + alturaArea}" stroke="var(--tinta-3)" stroke-width="1" stroke-dasharray="3 4"/>
      ${dados.map((s, k) => `<circle class="mk-bola" data-s="${k}" r="5" fill="${s.cor || 'var(--verde)'}" stroke="var(--papel-2)" stroke-width="2"/>`).join('')}
    </g>`;

  const meta = encodeURIComponent(JSON.stringify({
    m, larguraArea, alturaArea, min, faixa, n, L, altura, base100,
    series: dados.map(s => ({ nome: s.nome, valores: s.valores, plot: s.plot, cor: s.cor, casas: s.casas ?? 2, sufixo: s.sufixo || '' })),
    rotulos
  }));

  return `<svg viewBox="0 0 ${L} ${altura}" class="grafico-linha" data-meta="${meta}"
      preserveAspectRatio="none" style="touch-action:pan-y">
    ${grade}${eixoX}${linhas}${marcador}
    <rect class="captura" x="${m.esq}" y="${m.cima}" width="${larguraArea}" height="${alturaArea}" fill="transparent"/>
  </svg>`;
}

function formataEixo(v, casas) {
  // valores grandes viram "2,3k" para não estourar a margem
  if (Math.abs(v) >= 1000 && casas === 0) return numero(v / 1000, 1) + 'k';
  return numero(v, casas);
}

/* ------------------------------------------------------------
   3) INTERAÇÃO — passar o dedo/mouse mostra o valor daquele dia
   ------------------------------------------------------------ */
export function ativarGrafico(svg, aoMover) {
  if (!svg || svg.dataset.pronto) return;
  svg.dataset.pronto = '1';

  let meta;
  try { meta = JSON.parse(decodeURIComponent(svg.dataset.meta)); } catch { return; }

  const marcador = svg.querySelector('.marcador');
  const linha = svg.querySelector('.mk-linha');
  const bolas = [...svg.querySelectorAll('.mk-bola')];
  const captura = svg.querySelector('.captura');
  if (!captura) return;

  const px = i => meta.m.esq + (meta.n === 1 ? meta.larguraArea / 2 : (i / (meta.n - 1)) * meta.larguraArea);
  const py = v => meta.m.cima + meta.alturaArea - ((v - meta.min) / meta.faixa) * meta.alturaArea;

  function mover(evento) {
    const caixa = svg.getBoundingClientRect();
    const cliente = evento.touches ? evento.touches[0].clientX : evento.clientX;
    const xNoDesenho = ((cliente - caixa.left) / caixa.width) * meta.L;
    const fracao = (xNoDesenho - meta.m.esq) / meta.larguraArea;
    const i = Math.max(0, Math.min(meta.n - 1, Math.round(fracao * (meta.n - 1))));

    marcador.style.opacity = '1';
    linha.setAttribute('x1', px(i)); linha.setAttribute('x2', px(i));

    bolas.forEach((b, k) => {
      const v = meta.series[k]?.plot?.[i];
      if (v == null) { b.style.opacity = '0'; return; }
      b.style.opacity = '1';
      b.setAttribute('cx', px(i)); b.setAttribute('cy', py(v));
    });

    if (aoMover) {
      aoMover({
        indice: i,
        data: meta.rotulos[i],
        valores: meta.series.map(s => ({ nome: s.nome, cor: s.cor, valor: s.valores[i], casas: s.casas, sufixo: s.sufixo }))
      });
    }
  }

  function sair() {
    marcador.style.opacity = '0';
    if (aoMover) aoMover(null);
  }

  captura.addEventListener('mousemove', mover);
  captura.addEventListener('mouseleave', sair);
  captura.addEventListener('touchstart', e => { mover(e); }, { passive: true });
  captura.addEventListener('touchmove', e => { mover(e); }, { passive: true });
  captura.addEventListener('touchend', sair);
}

/* ------------------------------------------------------------
   4) GRÁFICO DE BARRAS (variação por região)
   ------------------------------------------------------------ */
export function graficoBarras(itens, altura = 210) {
  if (!itens.length) return '';
  const L = larguraDesenho();
  const m = { cima: 18, dir: 14, baixo: 42, esq: 42 };
  const larguraArea = L - m.esq - m.dir;
  const alturaArea = altura - m.cima - m.baixo;

  const vals = itens.map(i => i.valor);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const faixa = (max - min) || 1;
  const yZero = m.cima + alturaArea - ((0 - min) / faixa) * alturaArea;

  const largBarra = Math.min(64, (larguraArea / itens.length) * 0.56);
  const passo = larguraArea / itens.length;

  let corpo = `<line x1="${m.esq}" y1="${yZero.toFixed(1)}" x2="${L - m.dir}" y2="${yZero.toFixed(1)}" stroke="var(--linha)" stroke-width="1.5"/>`;

  itens.forEach((it, i) => {
    const cx = m.esq + passo * i + passo / 2;
    const y = m.cima + alturaArea - ((it.valor - min) / faixa) * alturaArea;
    const topo = Math.min(y, yZero);
    const alt = Math.max(2, Math.abs(y - yZero));
    const cor = it.valor >= 0 ? 'var(--alta)' : 'var(--baixa)';

    corpo += `<rect x="${(cx - largBarra / 2).toFixed(1)}" y="${topo.toFixed(1)}"
      width="${largBarra.toFixed(1)}" height="${alt.toFixed(1)}" rx="5" fill="${cor}" opacity=".85"/>`;
    corpo += `<text x="${cx.toFixed(1)}" y="${(it.valor >= 0 ? topo - 7 : topo + alt + 15).toFixed(1)}"
      text-anchor="middle" font-size="12" font-weight="700" fill="${cor}"
      font-family="system-ui" font-variant-numeric="tabular-nums">${it.rotuloValor}</text>`;
    corpo += `<text x="${cx.toFixed(1)}" y="${altura - 12}" text-anchor="middle"
      font-size="11.5" fill="var(--tinta-2)" font-family="system-ui">${it.rotulo}</text>`;
  });

  return `<svg viewBox="0 0 ${L} ${altura}" preserveAspectRatio="none">${corpo}</svg>`;
}
