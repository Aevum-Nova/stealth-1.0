# Connector Frontend Client

React + TypeScript frontend for the Ingestion & Synthesis Microservice.

## Tech

- React 19
- React Router 7
- TanStack Query 5
- ky
- React Hook Form + Zod
- Tailwind CSS
- Recharts
- Vitest + Testing Library

## Run locally

1. Install dependencies:
   - `pnpm install`
2. Copy env:
   - `cp .env.example .env`
   - Set `VITE_GOOGLE_CLIENT_ID` to enable Google sign-in on the login page.
3. Start dev server:
   - `pnpm dev`

Default API target is `http://localhost:3001/api/v1`.

## Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm preview`
- `pnpm test`
