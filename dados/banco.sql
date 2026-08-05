-- ============================================================
-- BOM DIA AGRO — banco de histórico de preços (Supabase)
--
-- COMO USAR:
--   1. Abra o Supabase > seu projeto > SQL Editor
--   2. Cole TODO este arquivo
--   3. Clique em RUN
--
-- Roda quantas vezes quiser: não apaga nada e não duplica nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) A TABELA DO HISTÓRICO
--
-- Uma linha = o preço de UM produto, em UM estado, num DIA.
-- A chave é (produto, regiao, data): se o robô rodar 8 vezes no
-- mesmo dia, ele atualiza a mesma linha em vez de criar oito.
-- ------------------------------------------------------------
create table if not exists precos_historico (
  produto        text        not null,
  regiao         text        not null,
  data           date        not null,

  preco          numeric(14,4) not null check (preco > 0),

  praca          text,           -- "Indicador CEPEA/B3 — Brasil"
  escopo         text,           -- nacional | porto | vizinho | estado
  fonte          text,           -- "CEPEA/ESALQ-USP"

  -- false = ainda pode mudar hoje · true = fechamento do dia, valor final
  fechado        boolean     not null default false,

  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  primary key (produto, regiao, data)
);

comment on table  precos_historico is 'Histórico diário de preços do Bom Dia Agro. Fonte: CEPEA/ESALQ-USP.';
comment on column precos_historico.fechado is 'true quando o dia virou e o valor não muda mais.';
comment on column precos_historico.escopo  is 'O que o número realmente é: indicador nacional, preço de porto ou cotação de estado vizinho.';


-- Índice para as consultas do app (série de um produto num estado)
create index if not exists idx_precos_serie
  on precos_historico (produto, regiao, data desc);

-- Índice para "o que mudou hoje"
create index if not exists idx_precos_data
  on precos_historico (data desc);


-- ------------------------------------------------------------
-- 2) CARIMBO AUTOMÁTICO DE ATUALIZAÇÃO
-- ------------------------------------------------------------
create or replace function marcar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_precos_atualizacao on precos_historico;
create trigger trg_precos_atualizacao
  before update on precos_historico
  for each row execute function marcar_atualizacao();


-- ------------------------------------------------------------
-- 3) SEGURANÇA (RLS)
--
-- Quem PODE LER: qualquer pessoa logada no app.
-- Quem PODE ESCREVER: só o robô, que usa a chave service_role.
--   (a service_role passa por cima do RLS — por isso ela NUNCA
--    pode ir para dentro do site; ela mora só nos Secrets do
--    GitHub. Ver COLOCAR-NO-AR.md.)
-- ------------------------------------------------------------
alter table precos_historico enable row level security;

drop policy if exists "logados podem ler o historico" on precos_historico;
create policy "logados podem ler o historico"
  on precos_historico
  for select
  to authenticated
  using (true);


-- ------------------------------------------------------------
-- 4) FECHAMENTO DO DIA
--
-- Marca como fechado tudo que é de dia anterior ao mais recente
-- daquela série. Ou seja: assim que chega a cotação de terça, a
-- de segunda vira definitiva.
--
-- O robô chama isso sozinho. Você pode rodar na mão se quiser.
-- ------------------------------------------------------------
create or replace function fechar_dias_anteriores()
returns integer
language plpgsql
as $$
declare
  quantas integer;
begin
  with ultimos as (
    select produto, regiao, max(data) as ultima
    from precos_historico
    group by produto, regiao
  )
  update precos_historico p
     set fechado = true
    from ultimos u
   where p.produto = u.produto
     and p.regiao  = u.regiao
     and p.data    < u.ultima
     and p.fechado = false;

  get diagnostics quantas = row_count;
  return quantas;
end;
$$;


-- ------------------------------------------------------------
-- 5) ATALHOS PARA CONSULTAR (opcional, mas útil)
-- ------------------------------------------------------------

-- O preço mais recente de cada produto/estado
create or replace view precos_hoje as
select distinct on (produto, regiao)
       produto, regiao, data, preco, praca, escopo, fonte, fechado
  from precos_historico
 order by produto, regiao, data desc;

-- Variação de um dia para o outro, já calculada
create or replace view variacao_diaria as
select produto,
       regiao,
       data,
       preco,
       lag(preco) over (partition by produto, regiao order by data) as preco_anterior,
       round(
         (preco - lag(preco) over (partition by produto, regiao order by data))
         / nullif(lag(preco) over (partition by produto, regiao order by data), 0) * 100
       , 2) as variacao_pct
  from precos_historico;


-- ============================================================
-- PRONTO.
--
-- Para conferir se deu certo, rode:
--     select count(*) from precos_historico;
--
-- No começo dá 0. Depois que o robô rodar pela primeira vez,
-- os números começam a aparecer e nunca mais somem.
-- ============================================================
