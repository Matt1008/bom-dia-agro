# 🚀 Colocar o Bom Dia Agro no ar (Netlify)

Guia completo, do zero até o link funcionando no celular dos seus amigos.
Tempo: uns **30 minutos** na primeira vez.

> **Por que é diferente do M+A Cine?**
> No M+A Cine você arrastou a pasta para o Netlify e pronto. Aqui não dá:
> o Bom Dia Agro precisa se atualizar sozinho todo dia de manhã, e os
> arquivos de preço mudam. Se você arrastar a pasta, os preços congelam no
> dia em que você arrastou. Por isso vamos ligar o Netlify no GitHub —
> assim o robô atualiza os preços e o Netlify republica sozinho.

**O caminho é este:**

```
Robô do GitHub busca os preços  →  salva no GitHub  →  Netlify publica sozinho
        (6h10 e 17h10)                                    (em ~30 segundos)
```

---

# PARTE 1 — Supabase (o login)

Sem isso, o cadastro fica preso no aparelho de cada pessoa: quem se cadastrar
no celular teria que se cadastrar de novo no computador.

## 1.1 — Criar o projeto

1. Entre em **https://supabase.com** e faça login (você já tem conta, do M+A Cine).
2. Clique em **New project**.
3. Preencha:
   - **Name:** `bom-dia-agro`
   - **Database Password:** clique em *Generate a password* e **guarde num lugar seguro**
     (você provavelmente não vai precisar dela, mas não dá para recuperar depois).
   - **Region:** `South America (São Paulo)` — é o mais perto, fica mais rápido.
4. Clique em **Create new project** e espere uns 2 minutos.

## 1.2 — Copiar as duas chaves

1. No menu da esquerda, clique na engrenagem **Project Settings**.
2. Clique em **API Keys** (ou **API**).
3. Copie os dois valores:
   - **Project URL** — parece com `https://xxxxxxxx.supabase.co`
   - **anon public** (ou **publishable**) — a chave comprida

> Essa chave **pode** ficar visível no site — ela foi feita para isso.
> **Nunca** use a chave `service_role` aqui. Essa é a chave-mestra.

## 1.3 — Desligar a confirmação de e-mail (importante!)

1. Menu da esquerda → **Authentication** → **Sign In / Providers** → **Email**.
2. **Desmarque** a opção **Confirm email**. Clique em **Save**.

**Por que desligar?** O Supabase grátis só manda **2 ou 3 e-mails por hora**. Se você
mandar o link num grupo e cinco amigos se cadastrarem juntos, os últimos não recebem
o e-mail e ficam trancados do lado de fora achando que o app quebrou.

**O que você perde:** ninguém confere se o e-mail existe de verdade. Alguém pode se
cadastrar com um e-mail inventado. Como o cadastro já pede o **código de convite**,
isso está de bom tamanho para um app entre amigos.

## 1.4 — Colar as chaves no app

1. Abra o arquivo `js/config.js` (clique com o botão direito → **Abrir com** → **Bloco de Notas**).
2. Ache o trecho `login:` e preencha as duas linhas:

```js
login: {
  modo: 'supabase',

  supabaseUrl: 'https://xxxxxxxx.supabase.co',
  supabaseChave: 'COLE-AQUI-A-CHAVE-ANON',

  codigoConvite: 'SAFRA2026'
},
```

3. Troque `SAFRA2026` pelo código que você quiser (é o que você vai passar aos amigos).
4. **Salve** o arquivo.

> Lembre do que já conversamos: o código de convite é um **trinco**, não uma fechadura.
> Ele segura quem recebeu o link sem querer. Quem entende de navegador consegue ler o
> código no site. A segurança de verdade é o e-mail e a senha.

---

# PARTE 2 — GitHub (onde o projeto mora)

## 2.1 — Criar a conta e o repositório

1. Crie a conta em **https://github.com** (grátis), se ainda não tiver.
2. Clique no **+** no canto superior direito → **New repository**.
3. Preencha:
   - **Repository name:** `bom-dia-agro`
   - Deixe em **Public**
   - **NÃO** marque nenhuma das caixinhas (README, .gitignore, license) —
     o projeto já tem tudo.
4. **Create repository**.

## 2.2 — Enviar os arquivos

O repositório local **já está criado e com o primeiro commit pronto**. Só falta enviar.

1. Abra a pasta `Bom Dia Agro` no Explorador de Arquivos.
2. Clique na **barra de endereço**, apague tudo, digite `cmd` e aperte **Enter**.
3. Como você mexeu no `config.js`, salve a mudança primeiro:

```bash
git add -A
```
```bash
git commit -m "Configura login na nuvem"
```

4. Agora conecte no GitHub — **troque `SEU-USUARIO`** pelo seu usuário:

```bash
git remote add origin https://github.com/SEU-USUARIO/bom-dia-agro.git
```
```bash
git push -u origin main
```

Vai abrir uma janela pedindo login do GitHub. Faça o login e pronto.

## 2.3 — Autorizar o robô a salvar os preços

1. No GitHub, abra seu repositório → **Settings** (engrenagem no menu de cima).
2. Menu da esquerda → **Actions** → **General**.
3. Role até **Workflow permissions**.
4. Marque **Read and write permissions** → **Save**.

**Sem esse passo o robô roda, busca os preços e não consegue salvar.** É o erro mais
comum.

## 2.4 — Testar o robô agora

1. Aba **Actions** (no menu de cima do repositório).
2. Clique em **Atualizar preços e notícias** na lista da esquerda.
3. Botão **Run workflow** → **Run workflow**.
4. Espere uns 40 segundos e recarregue. Se ficar com ✅ verde, está funcionando.

---

# PARTE 3 — Netlify (o site no ar)

## 3.1 — Conectar

1. Entre em **https://app.netlify.com**.
2. **Add new site** → **Import an existing project**.
3. Clique em **GitHub** e autorize o Netlify a ver seus repositórios.
4. Escolha o repositório **bom-dia-agro**.
5. Na tela de configuração, **não mexa em nada** — o arquivo `netlify.toml`
   que já está no projeto configura tudo sozinho:
   - *Build command:* vazio
   - *Publish directory:* `.`
6. Clique em **Deploy**.

Em uns 30 segundos o site está no ar.

## 3.2 — Escolher o endereço

O Netlify dá um nome sorteado, tipo `abacate-feliz-123.netlify.app`. Para trocar:

1. **Site configuration** → **General** → **Site details**.
2. Botão **Change site name**.
3. Escreva `bomdiaagro` (se estiver livre).

Seu link fica:

```
https://bomdiaagro.netlify.app
```

## 3.3 — Avisar o Supabase do endereço

1. Volte no Supabase → **Authentication** → **URL Configuration**.
2. Em **Site URL**, cole o endereço do Netlify: `https://bomdiaagro.netlify.app`
3. **Save**.

---

# PARTE 4 — Testar de verdade

1. Abra o link no **celular** (não no computador, para testar como seus amigos vão ver).
2. Clique em **Ainda não tenho conta — quero me cadastrar**.
3. Preencha nome, e-mail, senha e o **código de convite**.
4. Deve entrar direto na tela de preços.
5. Teste o botão **Exportar** → *Imagem para o grupo*: no celular abre o WhatsApp.
6. No menu do navegador, escolha **Adicionar à tela de início** — vira um ícone
   igual a um aplicativo.

**Confira também:** tente se cadastrar com um código errado. Tem que dar erro.

---

# Como fica o dia a dia

| Situação | O que fazer |
|---|---|
| Preços do dia | Nada. O robô atualiza às 6h10 e às 17h10, e o Netlify republica sozinho. |
| Mudar o código de convite | Edite `codigoConvite` em `js/config.js` → `git add -A` → `git commit -m "novo codigo"` → `git push` |
| Mudar cor, texto, produto | Edite o arquivo → os mesmos 3 comandos acima → o site atualiza em ~30 s |
| Ver quem se cadastrou | Supabase → **Authentication** → **Users** |
| Tirar o acesso de alguém | Supabase → **Authentication** → **Users** → os três pontinhos → **Delete user** |

## Os 3 comandos que você vai usar sempre

```bash
git add -A
```
```bash
git commit -m "escreva aqui o que voce mudou"
```
```bash
git push
```

---

# Se der problema

| Problema | Causa provável | Solução |
|---|---|---|
| "Modo de teste" aparece na tela de login | A URL ou a chave do Supabase estão vazias | Confira o Passo 1.4 e envie de novo com `git push` |
| Cadastro dá "Não consegui conectar" | URL do Supabase digitada errado | Tem que terminar em `.supabase.co`, sem barra no final |
| "Confirme seu e-mail antes de entrar" | A confirmação de e-mail ficou ligada | Passo 1.3 |
| Preços parados no mesmo dia | Robô sem permissão para salvar | Passo 2.3 |
| Aba Actions com ❌ vermelho | Quase sempre é a permissão | Passo 2.3. Se não for, clique no erro e leia a última linha |
| Netlify não republica | O robô não commitou (nada mudou) | Normal em fim de semana e feriado: sem pregão, sem preço novo |
| `git push` pede senha e recusa | O GitHub não aceita mais senha comum | Instale o **GitHub Desktop** (https://desktop.github.com) e faça o login por lá uma vez |
| Amigo diz que o app não abre | Cache do navegador dele | Peça para ele fechar a aba e abrir de novo |

---

# Quanto custa

**Nada.** Tudo dentro do plano grátis, com folga:

| Serviço | Plano grátis | Uso do app |
|---|---|---|
| GitHub Actions | 2.000 minutos/mês | ~30 minutos/mês |
| Netlify | 100 GB/mês | pouquíssimo (o site inteiro tem menos de 300 KB) |
| Supabase | 50.000 usuários | você e seus amigos |

O único cuidado: **projeto Supabase grátis dorme depois de 7 dias sem ninguém acessar.**
Se o app ficar uma semana parado, o primeiro login demora uns 30 segundos para acordar
o banco. Depois volta ao normal.
