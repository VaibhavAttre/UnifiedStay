# UnifiedStay

A unified property management platform for short-term rentals. Manage properties across Airbnb, Vrbo, and other channels from a single dashboard.

## Features

- **Multi-Property Dashboard**: View upcoming check-ins/outs, pending tasks, and key metrics
- **Unified Calendar**: Sync reservations from multiple channels with conflict detection
- **Channel Integration**: Connect via iCal URLs for calendar sync (Airbnb, Vrbo, etc.)
- **Auto-Sync**: Automatic calendar sync every 30 minutes
- **Task Management**: Auto-generate cleaning tasks from checkouts
- **Finance Tracking**: Track expenses, import payouts (CSV/PDF), and P&L by property

## Tech Stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Fastify, Prisma
- **Database**: PostgreSQL
- **Monorepo**: Turborepo + pnpm

## Prerequisites

- Node.js 18+
- pnpm 9+
- Docker (for local database)

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Local Database

```bash
docker-compose up -d
```

### 3. Set Up Environment Variables

Create `.env` files in the required directories:

**apps/api/.env**
```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unifiedstay
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
FRONTEND_URL=http://localhost:5173
```

### 4. Set Up Database

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push
```

### 5. Start Development Servers

```bash
pnpm dev
```

This starts:
- Frontend at http://localhost:5173
- Backend API at http://localhost:3001

## Project Structure

```
UnifiedStay/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── pages/          # Route pages
│   │   │   ├── hooks/          # React Query hooks
│   │   │   ├── lib/            # Utilities, API client
│   │   │   └── stores/         # Zustand stores
│   │   └── package.json
│   │
│   └── api/                    # Fastify backend
│       ├── src/
│       │   ├── modules/        # Feature modules
│       │   │   ├── auth/
│       │   │   ├── property/
│       │   │   ├── calendar/
│       │   │   ├── tasks/
│       │   │   └── finance/
│       │   ├── adapters/       # Channel adapters (iCal)
│       │   ├── lib/            # Shared utilities
│       │   └── server.ts
│       └── package.json
│
├── packages/
│   ├── database/               # Prisma schema + client
│   └── shared/                 # Shared types + schemas
│
├── docker-compose.yml          # Local Postgres + Redis
├── turbo.json                  # Turborepo config
└── package.json                # Root workspace
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user

### Properties
- `GET /api/properties` - List properties
- `POST /api/properties` - Create property
- `GET /api/properties/:id` - Get property details
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property
- `POST /api/properties/:id/channels` - Add channel connection

### Calendar
- `GET /api/calendar/events` - Get calendar events
- `POST /api/calendar/reservations` - Create reservation
- `POST /api/calendar/blocks` - Create availability block
- `POST /api/calendar/sync/:channelMappingId` - Trigger sync
- `GET /api/calendar/conflicts` - Get booking conflicts

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/generate` - Generate turnover tasks

### Finance
- `GET /api/finance/summary` - Get financial summary
- `GET /api/finance/expenses` - List expenses
- `POST /api/finance/expenses` - Create expense
- `GET /api/finance/revenues` - List revenues
- `POST /api/finance/revenues` - Create revenue
- `GET /api/finance/pnl` - Get P&L by property

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start all services
pnpm build            # Build all packages

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to database
pnpm db:migrate       # Run migrations

# Code Quality
pnpm lint             # Lint all packages
pnpm format           # Format code
```

### Adding a New Channel Adapter

1. Create adapter in `apps/api/src/adapters/`
2. Implement the channel interface
3. Register in the calendar service

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for a complete step-by-step guide to deploy:

- **Frontend** → Vercel (free)
- **Backend** → Render (free)
- **Database** → Neon Postgres (free)

Quick overview:
1. Create Neon database, copy connection string
2. Deploy backend to Render with environment variables
3. Deploy frontend to Vercel with API URL
4. Run database migrations

## API Sync

The calendar automatically syncs every 30 minutes. You can also:
- Click "Sync Now" on the Calendar page for immediate sync
- Use `POST /api/calendar/sync/all` to sync all channels via API

## License

MIT

