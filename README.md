# Lead Gen Backend — Prisma v7

## Quick Start

```bash
# 1. Install
npm install

# 2. Set up environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, CORS_ORIGINS

# 3. Push schema to database
npx prisma db push

# 4. Seed admin user
npm run db:seed

# 5. Run
npm run dev
```

## API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/auth/login` | Admin login |
| POST | `/api/leads` | Submit lead |

### Admin (Bearer token required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/me` | Current admin |
| GET | `/api/leads` | Paginated leads |
| GET | `/api/leads/export` | Download CSV |
| GET | `/api/leads/:id` | Lead detail |
| PATCH | `/api/leads/:id/status` | Update status |
| DELETE | `/api/leads/:id` | Delete lead |
| GET | `/api/analytics/summary` | Dashboard stats |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | NeonDB / Postgres connection string |
| `JWT_SECRET` | ✅ | Min 32 chars — generate with `openssl rand -hex 32` |
| `CORS_ORIGINS` | ✅ | Comma-separated frontend URLs |
| `SMTP_HOST` | optional | Leave blank to disable emails |
| `SMTP_FROM` | optional | e.g. `Business Internet <you@gmail.com>` |
| `ADMIN_EMAIL` | optional | Defaults to `admin@example.com` |
| `ADMIN_PASSWORD` | optional | Defaults to `Admin@123456` |

## Tech Stack
- **Node.js 20** + **Express 4**
- **TypeScript 5** (strict)
- **Prisma 7** with `@prisma/adapter-pg`
- **NeonDB** (PostgreSQL)
- **Nodemailer** (SMTP)
- **Zod** (validation)
- **JWT** (auth)
