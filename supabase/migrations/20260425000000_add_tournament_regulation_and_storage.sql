-- Add tournament regulation (PDF) fields and storage bucket for the AI assistant feature.
-- Idempotent: safe to run multiple times.

-- 1. Columns on tournaments to store the regulation PDF reference and extracted text.
alter table public.tournaments
  add column if not exists regulation_pdf_url text,
  add column if not exists regulation_text text,
  add column if not exists regulation_filename text,
  add column if not exists regulation_uploaded_at timestamptz;

comment on column public.tournaments.regulation_pdf_url is 'Public URL of the regulation PDF stored in the tournament-regulations bucket.';
comment on column public.tournaments.regulation_text is 'Plain text extracted from the regulation PDF, used as context for the tournament AI assistant.';
comment on column public.tournaments.regulation_filename is 'Original filename of the uploaded regulation PDF.';
comment on column public.tournaments.regulation_uploaded_at is 'Timestamp when the regulation PDF was last uploaded.';

-- 2. Public storage bucket for the regulation PDFs.
insert into storage.buckets (id, name, public)
values ('tournament-regulations', 'tournament-regulations', true)
on conflict (id) do nothing;

-- 3. Storage policies: public read, authenticated write/update/delete.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Public can read tournament regulations'
  ) then
    create policy "Public can read tournament regulations"
      on storage.objects for select
      using (bucket_id = 'tournament-regulations');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated can upload tournament regulations'
  ) then
    create policy "Authenticated can upload tournament regulations"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'tournament-regulations');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated can update tournament regulations'
  ) then
    create policy "Authenticated can update tournament regulations"
      on storage.objects for update to authenticated
      using (bucket_id = 'tournament-regulations')
      with check (bucket_id = 'tournament-regulations');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated can delete tournament regulations'
  ) then
    create policy "Authenticated can delete tournament regulations"
      on storage.objects for delete to authenticated
      using (bucket_id = 'tournament-regulations');
  end if;
end$$;
