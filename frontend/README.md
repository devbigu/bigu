# BigU Frontend

Next.js App Router frontend for the BigU internal growth planning app.

## Install

```bash
npm install
```

## Environment

Create `.env.local` or update `.env` as needed:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

If `NEXT_PUBLIC_API_URL` is not set, the API client defaults to `http://localhost:4000/api`.

## Run

```bash
npm run dev
```

Frontend URL: `http://localhost:3000`

The root page redirects to `/login`. The dashboard is available at `/dashboard` after authentication.

## Authentication

The login page uses one `Username or email` field and sends it to the backend as `identifier`. The frontend never stores JWTs in `localStorage` or `sessionStorage`. Axios sends credentials with each request, retries one failed authenticated request after `POST /auth/refresh`, and redirects to `/login` if refresh fails in the browser.

## Verify

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

## Structure

Business logic stays under `src/features`. App Router files under `src/app` should stay small and handle routing/layout boundaries only.

