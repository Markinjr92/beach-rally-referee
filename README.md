# VP Jukin

Painel administrativo construído com Vite + React + TypeScript + Tailwind CSS, integrado ao Supabase.

## Desenvolvimento local

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 8080
```

O projeto lê as variáveis de ambiente do Vite. Crie um arquivo `.env` com:

```env
VITE_SUPABASE_URL="https://lssbsmbjalsugejuxswa.supabase.co"
VITE_SUPABASE_ANON_KEY="<chave anon do projeto>"
VITE_SUPABASE_PUBLISHABLE_KEY="<mesma chave anon, mantida por retrocompatibilidade>"
```

> **Importante:** mantenha a chave de serviço (`SERVICE_ROLE`) fora do front-end. Ela será usada apenas dentro das Edge Functions.

## Supabase Edge Function `admin-user-management`

A função recebe requisições autenticadas e retorna a lista de usuários e suas roles. Ela exige que o token JWT pertença a um usuário com permissão `user.manage`.

### Deploy

1. Configure os *secrets* do projeto em **Supabase → Project Settings → Functions → Secrets**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
2. Execute o deploy:

   ```bash
   supabase functions deploy admin-user-management
   ```

### Respostas e CORS

A função agora aceita automaticamente requisições de:
- Origens configuradas localmente (localhost)
- Domínios `.lovable.app` (ambiente de desenvolvimento/preview)
- Origens configuradas via variável de ambiente `ADMIN_FN_ALLOWED_ORIGINS` (opcional)

- OPTIONS → 200 OK com cabeçalhos CORS.
- GET/POST → JSON com `{ ok: boolean, users?: [...] }` e os cabeçalhos:
  - `Access-Control-Allow-Origin: <origin do request>`
  - `Vary: Origin`
  - `Access-Control-Allow-Methods: GET,POST,OPTIONS`
  - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`

## Migrações SQL

O diretório `supabase/migrations` inclui uma função `public.get_admin_user_list()` que agrega usuários e suas roles. Execute as migrações localmente antes de publicar alterações.

```bash
supabase db reset
supabase db push
```

## Testes manuais recomendados

- Acessar `http://localhost:8080/admin/users` autenticado como administrador.
  - Preflight OPTIONS → 200 com os cabeçalhos CORS.
  - POST → 200 com JSON contendo a lista de usuários.
  - Tabela renderiza usuários e roles.
- Usuário deslogado ou sem permissão deve receber 401/403 e a interface mostra mensagem de erro amigável.
