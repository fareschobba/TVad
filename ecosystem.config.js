// Production deployment uses values from .env (loaded by src/server.js via dotenv).
// This file only sets PM2 metadata + a non-prod default for NODE_ENV.
// Do NOT put secrets here — they live in .env which is gitignored.
module.exports = {
  apps: [
    {
      name: "tvnew",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3002
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
