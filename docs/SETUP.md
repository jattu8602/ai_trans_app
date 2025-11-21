# Setup & Installation Guide

## Prerequisites

Before setting up ScribeAI, ensure you have the following installed:

- **Node.js**: Version 18.0 or higher
- **pnpm**: Package manager (install via `npm install -g pnpm`)
- **PostgreSQL**: Version 14 or higher (local or cloud instance)
- **Git**: For cloning the repository

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ai_trans_app

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
pnpm prisma migrate dev

# Start development server
pnpm dev
```

## Detailed Setup Steps

### 1. Install Dependencies

```bash
pnpm install
```

This will install all required packages including:
- Next.js 16.0.3
- React 19.2.0
- Prisma 7.0
- Socket.io
- Deepgram SDK
- Google Generative AI
- And other dependencies

### 2. Database Setup

#### Option A: Local PostgreSQL

```bash
# Install PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb scribeai_dev

# Or using psql
psql postgres
CREATE DATABASE scribeai_dev;
\q
```

#### Option B: Cloud PostgreSQL (Recommended for Production)

Use services like:
- **Supabase** (Free tier available)
- **Neon** (Serverless PostgreSQL)
- **Railway** (Easy setup)
- **AWS RDS** (Production-ready)

### 3. Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/scribeai_dev?schema=public"

# Deepgram API (for transcription)
NEXT_PUBLIC_DEEPGRAM_API_KEY="your_deepgram_api_key_here"

# Google Gemini API (for summaries)
GOOGLE_GEMINI_API_KEY="your_gemini_api_key_here"

# Optional: Gemini Model Name (defaults to gemini-2.0-flash)
GEMINI_MODEL_NAME="gemini-2.0-flash"

# Server Configuration
HOSTNAME="localhost"
PORT="3000"
NODE_ENV="development"

# Optional: App URL (for production)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

#### Getting API Keys

**Deepgram API Key:**
1. Visit [https://console.deepgram.com/](https://console.deepgram.com/)
2. Sign up for a free account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to `NEXT_PUBLIC_DEEPGRAM_API_KEY`

**Google Gemini API Key:**
1. Visit [https://ai.google.dev/](https://ai.google.dev/)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key to `GOOGLE_GEMINI_API_KEY`
5. Note: Free tier has rate limits

### 4. Database Migration

```bash
# Generate Prisma Client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Optional: Seed database (if seed script exists)
pnpm prisma db seed
```

### 5. Verify Installation

```bash
# Check if everything is set up correctly
pnpm run build

# If build succeeds, start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to verify the application is running.

## Development Server

The development server runs both Next.js and the custom Socket.io server:

```bash
pnpm dev
```

This command:
1. Generates Prisma Client
2. Starts the custom Node.js server (`server.ts`)
3. Initializes Socket.io
4. Starts Next.js development server

You should see:
```
> Ready on http://localhost:3000
> Socket.io available at http://localhost:3000/api/socket
```

## Production Build

```bash
# Build the application
pnpm run build

# Start production server
pnpm start
```

### Production Environment Variables

For production, ensure these are set:
- `DATABASE_URL` - Production database connection
- `NEXT_PUBLIC_DEEPGRAM_API_KEY` - Deepgram API key
- `GOOGLE_GEMINI_API_KEY` - Gemini API key
- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL` - Your production URL

## Troubleshooting Setup

### Issue: Prisma Client Not Generated

```bash
# Regenerate Prisma Client
pnpm prisma generate
```

### Issue: Database Connection Failed

1. Verify PostgreSQL is running:
   ```bash
   # macOS
   brew services list

   # Linux
   sudo systemctl status postgresql
   ```

2. Check connection string format:
   ```
   postgresql://username:password@host:port/database?schema=public
   ```

3. Test connection:
   ```bash
   psql $DATABASE_URL
   ```

### Issue: API Keys Not Working

1. **Deepgram**: Verify key is set in `.env` as `NEXT_PUBLIC_DEEPGRAM_API_KEY`
2. **Gemini**: Check if key has proper permissions
3. Restart development server after changing `.env`

### Issue: Port Already in Use

```bash
# Change port in .env
PORT=3001

# Or kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

### Issue: Socket.io Connection Failed

1. Verify Socket.io server is running (check console logs)
2. Check CORS configuration in `server/socket.ts`
3. Ensure `NEXT_PUBLIC_APP_URL` matches your actual URL

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `NEXT_PUBLIC_DEEPGRAM_API_KEY` | Yes | Deepgram API key for transcription | `abc123...` |
| `GOOGLE_GEMINI_API_KEY` | Yes | Google Gemini API key | `xyz789...` |
| `GEMINI_MODEL_NAME` | No | Gemini model to use | `gemini-2.0-flash` |
| `HOSTNAME` | No | Server hostname | `localhost` |
| `PORT` | No | Server port | `3000` |
| `NODE_ENV` | No | Environment mode | `development` or `production` |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL (for CORS) | `http://localhost:3000` |

## Development Tools

### Prisma Studio

View and edit database data:

```bash
pnpm prisma studio
```

Opens at [http://localhost:5555](http://localhost:5555)

### Database Migrations

```bash
# Create a new migration
pnpm prisma migrate dev --name migration_name

# Reset database (WARNING: Deletes all data)
pnpm prisma migrate reset

# View migration status
pnpm prisma migrate status
```

### TypeScript Type Checking

```bash
pnpm run type-check
# Or use your IDE's TypeScript checker
```

### Linting

```bash
pnpm run lint
```

## Browser Requirements

ScribeAI requires modern browser features:

- **MediaRecorder API**: For audio recording
- **getDisplayMedia API**: For system audio capture
- **IndexedDB**: For local chunk storage
- **WebSocket**: For Socket.io connection

**Supported Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+ (limited system audio support)

**Recommended**: Chrome or Edge for best system audio support.

## Next Steps

After setup:
1. Read [USAGE.md](./USAGE.md) to learn how to use the application
2. Check [API.md](./API.md) for API documentation
3. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design

## Getting Help

If you encounter issues:
1. Check [PROBLEMS.md](./PROBLEMS.md) for common issues and solutions
2. Review console logs for error messages
3. Verify all environment variables are set correctly
4. Ensure database is accessible and migrations are run

