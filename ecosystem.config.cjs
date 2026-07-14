// PM2 process definition for the Hostinger VPS.
//
//   pm2 start ecosystem.config.cjs      # first launch
//   pm2 startOrReload ecosystem.config.cjs --update-env   # zero-downtime redeploy
//   pm2 logs grn-desk                   # tail logs
//
// Single instance / fork mode on purpose: Socket.IO rooms and the login throttle
// are kept in-memory per process, so running multiple cluster workers would split
// that state (a socket update or a rate-limit counter on one worker wouldn't be
// seen by the others). One process is plenty for a warehouse-team workload.
module.exports = {
  apps: [
    {
      name: 'grn-desk',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      // Env lives in .env (loaded by dotenv in server/index.js). NODE_ENV is set
      // here so the process is flagged production even before .env is read.
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
