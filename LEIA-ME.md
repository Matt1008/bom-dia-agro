# ☀️ Bom Dia Agro

**O preço do seu dia, antes do café.**

App de preços do agro para **Mato Grosso** e **Pará**, com notícias e gráficos.
Funciona no celular e no computador. Não precisa instalar nada, não tem mensalidade,
não tem propaganda.

---

## O que já está pronto

| Tela | O que faz |
|---|---|
| **1 · Preços** | Preços de MT e PA, dólar e euro ao vivo, variação do dia, exportar para WhatsApp/PDF/imagem. Tocar num produto abre o detalhe com gráfico. |
| **2 · Notícias** | Notícias do agro de 4 sites, filtradas por hoje / semana / mês. |
| **3 · Gráficos** | Escolher produto, estado e período (diário, semanal, mensal, trimestral, anual) e comparar dois produtos. |
| **Login** | Cadastro com e-mail, senha e código de convite. |
| **Tema** | Claro e escuro. |

### Produtos cobertos

| Produto | MT | PA |
|---|:--:|:--:|
| Boi Gordo | ✅ | ✅ |
| Soja | ✅ | ✅ |
| Milho | ✅ | ✅ |
| Frango | ✅ | ✅ |
| Algodão | ✅ | — |
| Bezerro | ✅ | — |
| Suíno | ✅ | — |
| Café Conilon | — | ✅ |

---

## ⚠️ Leia isto: de onde vêm os números

**Tudo no app é cotação real do CEPEA/ESALQ-USP.** Não existe nenhum número simulado.
Se uma busca falhar, o app mantém o valor anterior e não inventa nada.

Mas tem uma coisa importante que você precisa saber, e que o app escreve na tela:

> **O CEPEA não publica preço de soja, milho ou boi específico de MT ou do PA.**
> Não existe fonte pública gratuita para isso. Nem o IMEA, nem a CONAB, nem ninguém
> abre esse dado de graça de um jeito confiável para um robô buscar todo dia.

Então o app mostra o que **existe de verdade**, sempre dizendo o que cada número é:

| Etiqueta | O que significa |
|---|---|
| **Indicador nacional** | O indicador único do Brasil — a referência que o mercado inteiro usa. Na sua porteira o preço muda conforme frete, prazo e negociação. |
| **Preço no porto** | Valor em Paranaguá. Para chegar ao preço na fazenda, desconte o frete até o porto. |
| **Estado vizinho** | Não há cotação pública do produto no seu estado. Este é o mercado publicado mais próximo (bezerro do MS, para o MT). |

Isso aparece no cartão, no detalhe do produto, no PDF e no texto do WhatsApp.

### Por que alguns períodos mostram "—"

O app só afirma que um preço subiu ou caiu quando tem **cotação real dos dois dias**.
A coleta começou em **04/08/2026**, então:

- **Ontem** → já funciona
- **Semana** → funciona a partir de ~11/08
- **Mês** → a partir de ~03/09
- **Ano** → a partir de agosto de 2027

Cada dia de coleta preenche mais um pedaço, sozinho. Não dá para acelerar isso sem
inventar número — e um preço errado com cara de certo, num grupo de WhatsApp onde
alguém pode fechar negócio em cima dele, é pior do que não ter app nenhum.

---

# PASSO A PASSO

## Passo 1 — Testar no seu computador (2 minutos)

1. Abra a pasta `Bom Dia Agro` no Explorador de Arquivos.
2. Clique na **barra de endereço**, apague tudo, digite `cmd` e aperte **Enter**.
3. Digite:

```bash
node scripts/servidor.mjs
```

4. Abra o navegador em **http://localhost:3000**
5. Crie uma conta (o código de convite está em `js/config.js`, hoje é `SAFRA2026`).

Para parar: **Ctrl + C** na janela preta.

> **Por que não dá para abrir o `index.html` com dois cliques?** O navegador bloqueia a
> leitura dos arquivos de dados quando o site é aberto direto do disco. Esse
> servidorzinho resolve, e já vem junto.

---

## Passo 2 — Atualizar os preços na mão (para testar)

```bash
node scripts/atualizar-precos.mjs
```

Mostra um relatório do que conseguiu buscar e o tamanho de cada série.

---

## Passo 3 — Colocar no ar para os amigos

Guia separado, passo a passo: **[COLOCAR-NO-AR.md](COLOCAR-NO-AR.md)**

Cobre, na ordem: **Supabase** (login) → **GitHub** (onde mora + robô) → **Netlify** (o site).

> **Atenção:** aqui **não dá** para arrastar a pasta no Netlify como no M+A Cine.
> Os arquivos de preço mudam todo dia — se arrastar, congelam.

---

## Como usar no dia a dia

- **Trocar de estado:** botões *Mato Grosso / Pará* na tela de preços. O app lembra.
- **Ver o gráfico de um produto:** toque no cartão.
- **Mandar no grupo:** botão verde **Exportar** →
  - *Imagem para o grupo* — no celular abre o WhatsApp direto; no PC baixa o PNG.
  - *Abrir no WhatsApp* — manda a lista em texto.
  - *Salvar em PDF* — abre a impressão; escolha **Salvar como PDF**.
  - *Copiar o texto* — cola onde quiser.

---

## Onde mexer em cada coisa

| Quero... | Arquivo |
|---|---|
| Trocar cores e o visual | `css/estilo.css` |
| Trocar o código de convite | `js/config.js` → `login.codigoConvite` |
| Ligar o login na nuvem | `js/config.js` → `login.supabaseUrl` e `supabaseChave` |
| Acrescentar estado ou produto | `js/config.js` **e** `scripts/atualizar-precos.mjs` |
| Trocar os sites de notícia | `scripts/atualizar-precos.mjs` → lista `FEEDS` |
| Mudar o horário da atualização | `.github/workflows/atualizar.yml` → linhas `cron` |
| Mudar os ícones | `js/icones.js` |

### Acrescentar um produto novo

1. Ache o código do indicador no CEPEA (os que existem estão listados em
   `scripts/atualizar-precos.mjs`; a maioria dos códigos entre 1 e 460 **não** existe).
2. Adicione em `js/config.js`, na lista `PRODUTOS`.
3. Adicione em `scripts/atualizar-precos.mjs`, na lista `FONTES`:

```js
{ produto: 'arroz', indicador: 126, regioes: ['mt'],
  praca: 'Média CEPEA/IRGA — RS', escopo: 'vizinho' },
```

4. Se a unidade for diferente da que o app mostra, acrescente a conversão:

```js
converte: v => v * 0.06,   // de R$/tonelada para R$/saca de 60kg
```

5. Rode `node scripts/atualizar-precos.mjs` e confira o relatório.

### Indicadores do CEPEA que existem e funcionam

Descobertos varrendo os códigos de 1 a 460 (só ~30 existem):

| Código | Produto | Código | Produto |
|---|---|---|---|
| 2 | Boi Gordo (nacional) | 92 | Soja Paranaguá |
| 3 | Bezerro SP | 124 | Suíno carcaça |
| 8 | Bezerro MS | 126 | Arroz RS |
| 12 | Soja PR | 130 | Frango resfriado |
| 23 | Café Arábica | 162 | Citros SP |
| 24 | Café Robusta | 178 | Trigo PR (R$/t) |
| 35 | Açúcar PE | 179 | Trigo RS (R$/t) |
| 53 | Açúcar SP | 181 | Frango congelado |
| 54 | Algodão (¢R$/libra) | 308 | Açúcar Santos |
| 72 | Mandioca PR | 77 | Milho (nacional) |

---

## Se der problema

| Problema | Solução |
|---|---|
| Página em branco | Você abriu o `index.html` com dois cliques. Use o servidor (Passo 1). |
| `node` não é reconhecido | Instale o Node.js: https://nodejs.org (botão LTS) e reabra a janela preta. |
| "Modo de teste" no login | Falta preencher Supabase em `js/config.js`. |
| Variação aparece "—" | Normal: falta histórico para aquele período. Veja a seção lá em cima. |
| Preços não atualizam no site | Permissão de escrita nas Actions — passo 2.3 do [COLOCAR-NO-AR.md](COLOCAR-NO-AR.md). |
| Notícias vazias | Rode a atualização. Se um site cair, os outros continuam. |

---

## Créditos e uso

- **Preços:** CEPEA/ESALQ-USP — citado em todas as telas, no PDF e nas imagens
  exportadas. Se um dia for cobrar pelo app, confira antes as condições de uso deles.
- **Moedas:** AwesomeAPI.
- **Notícias:** Canal Rural, Agrolink, Compre Rural, G1 Agro — o app mostra só título e
  resumo curto, e o link leva ao site original.
- **Gráficos e ícones:** SVG desenhados à mão dentro do projeto. Nenhuma biblioteca
  baixada da internet — por isso o app abre mesmo com sinal fraco de fazenda.

**Aviso:** valores de referência. Confirme sempre com seu comprador antes de fechar
negócio. Este app não dá recomendação de compra ou venda.
