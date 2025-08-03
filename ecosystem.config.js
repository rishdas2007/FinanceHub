module.exports = {
  apps: [
    {
      name: 'financehub-pro',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // PM2 Configuration
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      // Health monitoring
      health_check_grace_period: 10000,
      health_check_fatal_exceptions: true,
      // Restart configuration
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      // Performance monitoring
      pmx: true,
      monitoring: true,
      // Source maps for debugging
      source_map_support: true,
    },
  ],
};