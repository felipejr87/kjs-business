# KJS Business

Vitrine pública e painel de gestão para intermediação de carros e imóveis.

## Stack
- Frontend: HTML + CSS + JavaScript vanilla
- Backend: Supabase (PostgreSQL + RLS + Storage)
- Deploy: Vercel
- PWA pronto

## Estrutura
- `index.html` — Vitrine pública
- `anuncio.html` — Detalhe de anúncio
- `admin.html` — Painel do Kleber (protegido por senha)
- `js/core.js` — Supabase client, auth, helpers
- `js/vitrine.js` — Lógica da vitrine
- `js/anuncio.js` — Detalhe do anúncio
- `js/admin.js` — Painel: dashboard, CRUD, vendas

## Supabase
- Project ID: `nmdshljajpcnvnoebaqi`
- Região: `sa-east-1` (São Paulo)

## Primeiro acesso ao painel
- URL: `/admin.html`
- Senha padrão: `KJS2025`
- **Alterar senha imediatamente** via SQL Editor:
  ```sql
  UPDATE config SET senha_hash = crypt('NOVA_SENHA', gen_salt('bf')) WHERE id = 1;
  ```

## Deploy Vercel
1. Conectar repositório GitHub na Vercel
2. Framework preset: `Other`
3. Build command: (vazio)
4. Output directory: `.`
