# Lead Gen Backend

Express + Prisma/PostgreSQL API for lead capture, admin lead management, analytics, and email workflows.

## Quick Start

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Run the email worker in a second terminal when `REDIS_URL` is configured:

```bash
npm run dev:worker
```

## Production Notes

- Run migrations as a release step with `npm run db:migrate:deploy`; the API container does not run migrations on startup.
- `REDIS_URL` is required in production for BullMQ email jobs, analytics cache, and distributed rate limits.
- Start both processes: `npm start` for the API and `npm run start:worker` for queued email delivery.
- `GET /health` is lightweight. `GET /health/ready` checks PostgreSQL and Redis.
- CSV exports stream in batches and are capped by `MAX_EXPORT_ROWS` (`50000` by default).

## Docker Compose

```bash
docker compose up --build
```

Compose starts Postgres, Redis, a one-shot migration service, the API, and the email worker. Set `JWT_SECRET` in your shell or `.env` before starting.

## API Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Lightweight health check |
| GET | `/health/ready` | DB/Redis readiness check |
| POST | `/api/auth/login` | Admin login |
| POST | `/api/auth/password-reset/request` | Request password reset email |
| POST | `/api/auth/password-reset/confirm` | Confirm password reset token |
| POST | `/api/leads` | Submit lead |

### Admin (Bearer token required)

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/me` | Current admin |
| POST | `/api/auth/logout-all` | Revoke active admin tokens |
| POST | `/api/auth/change-password` | Change current admin password |
| POST | `/api/auth/admin` | Create another admin |
| GET | `/api/leads` | Paginated leads |
| GET | `/api/leads/export` | Stream CSV export |
| GET | `/api/leads/:id` | Lead detail |
| PATCH | `/api/leads/:id/status` | Update status |
| POST | `/api/leads/:id/email` | Queue custom email |
| DELETE | `/api/leads/:id` | Delete lead |
| GET | `/api/analytics/summary` | Cached dashboard stats |

## Verification

```bash
npm.cmd run typecheck
npm.cmd run build
npx.cmd prisma validate
npm.cmd audit --omit=dev
npm.cmd test
```
