# Neon Database Setup

Este guia serve como referencia rapida para conectar o projeto ao Neon, inicializar o banco e criar novas integracoes no futuro.

## 1. Conectar o projeto ao Neon

Se voce estiver usando Vercel + Neon:

1. Conecte o projeto no painel da Vercel.
2. Abra a aba `Storage`.
3. Selecione o banco Neon vinculado.
4. Rode localmente:

```bash
vercel env pull .env.development.local
```

Se voce estiver configurando manualmente, crie um arquivo `.env` local baseado em [`.env.example`](C:/Users/default.LAPTOP-K8F2QHAF/projects/rotaposto/.env.example).

Campos mais importantes:

```env
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

## 2. Qual URL usar

Neste projeto, a conexao em [lib/db.ts](C:/Users/default.LAPTOP-K8F2QHAF/projects/rotaposto/lib/db.ts) prefere:

1. `DATABASE_URL_UNPOOLED`
2. `DATABASE_URL`

Motivo:

- Em desenvolvimento local, a conexao direta (`UNPOOLED`) tende a ser mais confiavel com o driver atual.
- Em integracoes simples e ambientes serverless, `DATABASE_URL` continua sendo valida.

## 3. Instalar a dependencia

O projeto ja usa `@neondatabase/serverless`, mas em novos apps ou novas integracoes o comando e:

```bash
npm install @neondatabase/serverless
```

ou, neste repositorio:

```bash
pnpm add @neondatabase/serverless
```

## 4. Inicializar schema e seed

Para preparar um banco Neon vazio para o Rotaposto, rode:

```bash
node scripts/init-neon-db.mjs
```

Esse script:

- cria extensao `postgis`
- cria enums e tabelas principais
- cria indices e trigger de localizacao
- popula dados iniciais para testes

Arquivos relacionados:

- [scripts/init-neon-db.mjs](C:/Users/default.LAPTOP-K8F2QHAF/projects/rotaposto/scripts/init-neon-db.mjs)
- [scripts/000-init-schema.sql](C:/Users/default.LAPTOP-K8F2QHAF/projects/rotaposto/scripts/000-init-schema.sql)
- [scripts/001-setup-postgis.sql](C:/Users/default.LAPTOP-K8F2QHAF/projects/rotaposto/scripts/001-setup-postgis.sql)
- [scripts/002-seed-data.sql](C:/Users/default.LAPTOP-K8F2QHAF/projects/rotaposto/scripts/002-seed-data.sql)

## 5. Exemplo simples com Next.js Server Action

Se voce quiser criar uma integracao minima para testar escrita no banco, o fluxo recomendado e este:

1. Criar uma tabela simples no Neon:

```sql
CREATE TABLE IF NOT EXISTS comments (
  comment TEXT
);
```

2. Criar uma pagina com Server Action:

```tsx
// app/page.tsx
import { neon } from '@neondatabase/serverless'

export default function Page() {
  async function create(formData: FormData) {
    'use server'

    const sql = neon(
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || ''
    )

    const comment = formData.get('comment')

    await sql.query('INSERT INTO comments (comment) VALUES ($1)', [comment])
  }

  return (
    <form action={create}>
      <input type="text" name="comment" placeholder="write a comment" />
      <button type="submit">Submit</button>
    </form>
  )
}
```

3. Rodar localmente:

```bash
pnpm dev
```

4. Validar no banco:

```sql
SELECT * FROM comments;
```

## 6. Exemplo usando o helper do projeto

Para endpoints e rotas do Rotaposto, prefira reutilizar [lib/db.ts](C:/Users/default.LAPTOP-K8F2QHAF/projects/rotaposto/lib/db.ts):

```ts
import { getSql } from '@/lib/db'

export async function GET() {
  const sql = getSql()
  const rows = await sql`SELECT NOW() AS now`
  return Response.json(rows[0])
}
```

Use esse helper quando:

- estiver criando `app/api/.../route.ts`
- precisar manter o mesmo criterio de conexao do projeto
- quiser padronizar acesso ao Neon

## 7. Smoke tests recomendados

Depois de configurar o banco, estes testes sao bons sinais de que tudo esta ok:

```bash
pnpm build
pnpm lint
```

E, com o app rodando:

```bash
curl "http://localhost:3000/api/stations/nearby?lat=-23.561414&lng=-46.655881&radius=2000"
curl "http://localhost:3000/api/geocode?q=Avenida%20Paulista%2C%20Sao%20Paulo"
```

## 8. Checklist para futuras integracoes

- Confirmar que `.env` ou `.env.development.local` contem `DATABASE_URL`
- Preferir adicionar `DATABASE_URL_UNPOOLED` para uso local
- Reutilizar [lib/db.ts](C:/Users/default.LAPTOP-K8F2QHAF/projects/rotaposto/lib/db.ts) quando possivel
- Se o banco estiver vazio, rodar `node scripts/init-neon-db.mjs`
- Rodar `pnpm build` e `pnpm lint` apos a integracao
- Validar pelo menos um endpoint com dados reais

## 9. Observacao importante

Se uma connection string do Neon foi exposta em chat, ticket, commit ou print:

1. gire a credencial no painel do Neon
2. atualize as variaveis na Vercel
3. atualize o `.env` local

Nao versionar `.env` com credenciais reais.
