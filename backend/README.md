# BigU Backend

NestJS API for the BigU internal growth planning app.

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env` and fill the required secrets. Do not commit real secrets.

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bigu
JWT_ACCESS_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

The app validates `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` at startup. `PORT` defaults to `4000`.

## Database

Create a PostgreSQL database named `bigu` or update `DATABASE_URL` for your chosen database name.

```bash
createdb bigu
```

Run the initial auth migration:

```bash
npx prisma migrate dev --name init_auth
```

The Prisma 7 client is generated into `src/generated/prisma`:

```bash
npx prisma generate
```

## First Admin

BigU registration is only open for bootstrap. `POST /api/auth/register` creates a user only when the database has zero users. That first user becomes `ADMIN`. Registration now requires `name`, `username`, `email`, and `password`; usernames are stored lowercase and must be 3-30 letters, numbers, underscores, or periods. Once any user exists, registration is blocked until a future admin user-management feature is added.

## Run

```bash
npm run start:dev
```

API base URL: `http://localhost:4000/api`

Swagger: `http://localhost:4000/api/docs`

Health: `GET /api/health`

## Auth Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Login accepts one `identifier` field containing either username or email plus the password. Auth uses HttpOnly cookies named `bigu_access_token` and `bigu_refresh_token`. Cookies are `SameSite=lax`, use `secure` in production, and refresh tokens are rotated and stored only as Argon2 hashes.

## Verify

```bash
npm run lint
npm test -- --runInBand
npx tsc --noEmit
npx prisma validate
npx prisma generate
npm run build
```

## Safe First-Admin Bootstrap Command

After the backend is running against an empty development database, create the initial admin through the first-user registration endpoint without putting the password in shell history:

```powershell
$password = Read-Host -AsSecureString "Initial admin password"
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/auth/register" -ContentType "application/json" -Body (@{
  name = "Aditya"
  username = "aditya"
  email = "adityaxsetia@gmail.com"
  password = $plainPassword
} | ConvertTo-Json)
Remove-Variable plainPassword
```
