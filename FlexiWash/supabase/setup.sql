-- FlexiWash · esquema mínimo para Supabase (pégalo en SQL Editor → Run; es seguro ejecutarlo más de una vez).
-- DEMO: las políticas permiten leer y escribir a cualquiera que tenga la llave pública (anon).
-- Para producción, reemplázalas por Supabase Auth + políticas por usuario.

create table if not exists public.fw_docs (
  col        text        not null,                 -- colección: requests, messages, providers, photos…
  id         text        not null,                 -- id del documento dentro de la colección
  data       jsonb       not null,                 -- el documento tal como lo maneja store.js
  created_at timestamptz not null default now(),   -- conserva el orden de creación
  primary key (col, id)
);
create index if not exists fw_docs_col_created_idx on public.fw_docs (col, created_at);

alter table public.fw_docs enable row level security;
drop policy if exists "demo_all" on public.fw_docs;
create policy "demo_all" on public.fw_docs for all to anon using (true) with check (true);

-- Fotos del servicio (bucket público de lectura)
insert into storage.buckets (id, name, public) values ('fw-photos', 'fw-photos', true) on conflict (id) do nothing;
drop policy if exists "demo_photos_select" on storage.objects;
drop policy if exists "demo_photos_insert" on storage.objects;
drop policy if exists "demo_photos_delete" on storage.objects;
create policy "demo_photos_select" on storage.objects for select to anon using (bucket_id = 'fw-photos');
create policy "demo_photos_insert" on storage.objects for insert to anon with check (bucket_id = 'fw-photos');
create policy "demo_photos_delete" on storage.objects for delete to anon using (bucket_id = 'fw-photos');
