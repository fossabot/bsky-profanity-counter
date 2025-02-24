# Bluesky Profanity Counter Bot

A Bluesky bot that analyzes users' post history to count and report on their profanity usage.

## Features

- Responds to mentions/tags in replies
- Analyzes post history for profanity
- Provides statistics on profanity usage
- Caches results for better performance

## Tech Stack

- TypeScript
- Node.js
- Prisma
- PostgreSQL
- @atproto/api (Bluesky API)

## Prerequisites

- Node.js 20+
- PostgreSQL
- Bluesky account credentials

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/bsky_profanity"
   BLUESKY_IDENTIFIER="your-handle.bsky.social"
   BLUESKY_PASSWORD="your-app-password"
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
5. Start the bot:
   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

## Deployment

This project can be deployed on any Node.js hosting platform. Some options include:

1. Railway
2. Fly.io
3. DigitalOcean
4. Heroku

Make sure to set up the required environment variables on your hosting platform.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## License

MIT
