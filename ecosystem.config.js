// PM2 process definition for the Next.js standalone server (alternative to the
// Docker `app` container documented in docs/DEPLOY.md — Postgres still runs via
// Docker, see docker-compose.pm2-db.yml).
//
// Single fork instance ON PURPOSE: pg-boss (lib/queue/boss.ts) registers cron
// jobs in instrumentation.ts and the in-process rate limiter (lib/ratelimit)
// keeps its buckets in memory — `cluster` mode would duplicate the pg-boss
// workers and fragment the rate-limit state across processes.
//
// `.env.production` here must point DATABASE_URL at 127.0.0.1:5432 (the host
// loopback exposed by docker-compose.pm2-db.yml), NOT `db:5432` — that
// hostname only resolves inside the Docker compose network.
try {
  process.loadEnvFile(require('path').join(__dirname, '.env.production'))
} catch {
  // .env.production not found — assume vars are already in the environment.
}

module.exports = {
  apps: [
    {
      name: 'luizinha',
      script: 'server.js',
      cwd: './.next/standalone',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3000',
        // Loopback only — nginx is the only thing allowed to reach this port,
        // same boundary the Docker setup enforces with 127.0.0.1:3000.
        HOSTNAME: '127.0.0.1',
      },
    },
  ],
}
