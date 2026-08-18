# RELAIS

RELAIS is the mobile application built with Expo and TypeScript.

## Local development

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm run start
```

Run linting and TypeScript checks:

```bash
npm run lint
npm run typecheck
```

Expo Router routes live in `app/`. Reusable application code belongs in `src/`.
Product architecture documentation lives in `docs/product/`.

## Persistence foundation

The PostgreSQL schema and migrations live in `prisma/`. Set the server-only
`DATABASE_URL` in `.env` before connecting to a development database. The
mobile app must not import the Prisma client directly.

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
```
