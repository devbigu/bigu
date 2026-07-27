# BigU

BigU is an internal social-media growth planning application. This repository contains two separate apps:

- `frontend`: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- `backend`: NestJS, TypeScript, PostgreSQL, Prisma

Phase 1 implements the application foundation and end-to-end cookie authentication only, including username-or-email login for internal accounts. Clients, projects, references, AI, Meta, reports, Google Sheets sync, and month-end workflows remain placeholders for later phases.

## Local Setup

1. Install dependencies in each app:

```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Configure backend environment from `backend/.env.example`.

3. Create a PostgreSQL database and set `DATABASE_URL`.

4. Run backend migrations and generate Prisma:

```bash
cd backend
npx prisma migrate dev --name init_auth
npx prisma generate
```

5. Start both apps:

```bash
cd backend && npm run start:dev
cd frontend && npm run dev
```

Backend API: `http://localhost:4000/api`

Swagger: `http://localhost:4000/api/docs`

Frontend: `http://localhost:3000`

