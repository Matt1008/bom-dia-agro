# ☀️ Bom Dia Agro

**O preço do seu dia, antes do café.**

App de preços do agro, notícias e gráficos. Funciona no celular e no computador.
Não precisa instalar nada, não tem mensalidade, não tem propaganda.

---

## O que já está pronto e funcionando

| Tela | O que faz |
|---|---|
| **1 · Preços** | Preços por região, dólar e euro ao vivo, variação do dia, exportar para WhatsApp/PDF/imagem. Tocar num produto abre o gráfico dos últimos 5 dias. |
| **2 · Notícias** | Notícias do agro de 4 sites, filtradas por hoje / semana / mês. |
| **3 · Gráficos** | Escolher produto, região e período (diário, semanal, mensal, trimestral, anual) e comparar dois produtos. |
| **Login** | Cadastro e entrada com e-mail e senha. |
| **Tema** | Claro e escuro, botão no canto de cima. |

---

## ⚠️ Leia isto primeiro: de onde vêm os números

O app **nunca inventa número escondido**. Ele sempre mostra a origem de cada preço:

- **Cotação real** — vem do CEPEA/ESALQ-USP (a referência oficial usada pelo mercado
  brasileiro). Hoje são **16 indicadores reais**: boi gordo, bezerro (SP e MS), soja,
  milho, café arábica, café robusta, algodão, trigo, arroz, suíno, frango, açúcar
  (SP e PE), mandioca e laranja.

- **Etiqueta laranja "exemplo"** — produto **sem fonte pública gratuita** disponível
  (leite, ovos, feijão, sorgo, vaca gorda). O número é **simulado**, serve só para você
  ver a tela funcionando. Aparece marcado na tela, no PDF, na imagem e no texto do
  WhatsApp. **Nunca use para negociar.**

- **Traço "—" na variação** — significa "ainda não sei". O app só afirma que um preço
  subiu ou caiu quando tem cotação real dos dois dias. Como a coleta começou agora,
  no começo aparece "—" em quase tudo. **Amanhã já aparece a variação do dia**, em uma
  semana a da semana, em um mês a do mês.

- **Linha tracejada no gráfico** — trecho estimado (antes de a coleta começar).
  **Linha sólida** — cotação coletada de verdade. A cada dia o tracejado encolhe.

> Isso foi feito de propósito. Um app de preço que mostra número errado com cara de
> certo é pior do que não ter app — principalmente quando o valor vai parar num grupo
> de WhatsApp e alguém fecha negócio em cima dele.

---

# PASSO A PASSO

## Passo 1 — Testar no seu computador (2 minutos)

1. Abra a pasta `Bom Dia Agro` no Explorador de Arquivos.
2. Clique na **barra de endereço** (onde aparece o caminho da pasta), apague tudo,
   digite `cmd` e aperte **Enter**. Vai abrir uma janela preta já na pasta certa.
3. Digite o comando abaixo e aperte Enter:

   ```
   node scripts/servidor.mjs
   ```

4. Abra o navegador em: **http://localhost:3000**
5. Crie uma conta qualquer (nome, e-mail, senha de 6 letras) e pronto.

Para parar o servidor: volte na janela preta e aperte **Ctrl + C**.

> **Por que não dá para abrir o `index.html` com dois cliques?**
> O navegador bloqueia a leitura dos arquivos de dados quando o site é aberto direto
> do disco. Esse servidorzinho resolve — e ele já veio junto, não precisa instalar nada.

---

## Passo 2 — Atualizar os preços na mão (para testar)

Na mesma janela preta (pare o servidor antes com Ctrl + C):

```
node scripts/atualizar-precos.mjs
```

Ele vai buscar preços, moedas e notícias e mostrar um relatório do que conseguiu.
Depois é só ligar o servidor de novo e recarregar a página.

---

## Passo 3 — Colocar no ar para os amigos

Está tudo num guia separado, passo a passo: **[COLOCAR-NO-AR.md](COLOCAR-NO-AR.md)**

Ele cobre, na ordem:

1. **Supabase** — o login de verdade, para a pessoa se cadastrar no celular e
   conseguir entrar também no computador.
2. **GitHub** — onde o projeto mora e de onde o robô atualiza os preços sozinho.
3. **Netlify** — o site no ar, com um link para mandar no grupo.

> **Atenção:** aqui **não dá** para arrastar a pasta no Netlify como você fez no
> M+A Cine. Os arquivos de preço mudam todo dia — se arrastar, os preços congelam.
> O guia explica o caminho certo (Netlify ligado no GitHub).

---

## Como usar o app no dia a dia

- **Escolher sua região:** botões *Centro-Oeste, Sul, Sudeste...* na tela de preços.
  O app lembra da sua escolha.
- **Ver o gráfico de um produto:** toque no cartão do produto.
- **Mandar no grupo do WhatsApp:** botão verde **Exportar** →
  - *Imagem para o grupo* — no celular abre o WhatsApp direto; no PC baixa o PNG.
  - *Abrir no WhatsApp* — manda a lista em texto.
  - *Salvar em PDF* — abre a impressão; escolha **Salvar como PDF**.
  - *Copiar o texto* — cola onde quiser.
- **Modo escuro:** ícone de lua no canto superior direito.

---

## Onde mexer em cada coisa

| Quero... | Arquivo |
|---|---|
| Trocar cores, tamanhos, o visual | `css/estilo.css` |
| Adicionar/remover produtos e regiões | `js/config.js` |
| Ligar o login na nuvem | `js/config.js` |
| Mudar de onde vêm os preços | `scripts/atualizar-precos.mjs` (lista `FONTES_CEPEA`) |
| Trocar os sites de notícia | `scripts/atualizar-precos.mjs` (lista `FEEDS`) |
| Mudar o horário da atualização | `.github/workflows/atualizar.yml` (linhas `cron`) |
| Mudar os ícones | `js/icones.js` |

### Adicionar um novo preço real

1. Ache o código do indicador no site do CEPEA.
2. Abra `scripts/atualizar-precos.mjs` e adicione uma linha na lista `FONTES_CEPEA`:

```js
{ produto: 'feijao', indicador: 999, praca: 'Onde é cotado', regioes: ['sudeste'] },
```

3. Se a unidade do CEPEA for diferente da que o app mostra, acrescente a conversão:

```js
converte: v => v * 0.06,   // exemplo: de R$/tonelada para R$/saca de 60kg
```

4. Rode `node scripts/atualizar-precos.mjs` e confira o relatório.

---

## Se der problema

| Problema | Solução |
|---|---|
| Página em branco | Você abriu o `index.html` com dois cliques. Use o servidor (Passo 1). |
| `node` não é reconhecido | Instale o Node.js: https://nodejs.org (botão LTS) e reabra a janela preta. |
| Preços não atualizam no site | Permissão de escrita nas Actions — veja o passo 2.3 do [COLOCAR-NO-AR.md](COLOCAR-NO-AR.md). |
| Aba Actions vermelha | Clique no erro e leia a última linha; quase sempre é a permissão do passo 2.3. |
| "Modo de teste" na tela de login | Falta preencher a URL e a chave do Supabase em `js/config.js` (passo 1.4). |
| Notícias vazias | Rode `node scripts/atualizar-precos.mjs`. Se um site estiver fora do ar, os outros continuam. |

---

## Créditos e uso

- **Preços:** CEPEA/ESALQ-USP — dado público, citado em todas as telas, no PDF e nas
  imagens exportadas. Se um dia você for cobrar pelo app, confira antes as condições
  de uso no site do CEPEA.
- **Moedas:** AwesomeAPI.
- **Notícias:** Canal Rural, Agrolink, Compre Rural, G1 Agro — o app mostra só o título
  e um resumo curto, e o link leva para o site original.
- **Gráficos e ícones:** desenhados à mão em SVG dentro do próprio projeto.
  Nenhuma biblioteca baixada da internet — por isso o app abre mesmo com sinal fraco.

**Aviso:** os valores são de referência. Confirme sempre com seu comprador antes de
fechar negócio. Este app não dá recomendação de compra ou venda.
