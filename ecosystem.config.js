module.exports = {
  apps: [
    {
      name: 'judgeit-api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/home/ubuntu/app/logs/pm2-error.log',
      out_file: '/home/ubuntu/app/logs/pm2-out.log',
      log_file: '/home/ubuntu/app/logs/pm2-combined.log',
      time: true,
    },
  ],
};
