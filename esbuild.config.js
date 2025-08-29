// ESBuild configuration for production deployment
export default {
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  packages: 'external',
  resolveExtensions: ['.ts', '.js'],
  external: [
    '@neondatabase/serverless', 
    'ws', 
    'drizzle-orm',
    'pg-pool',
    'pg-query-stream',
    'pino',
    'pino-pretty',
    'drizzle-kit',
    'ioredis',
    'node-cron'
  ],
  loader: {
    '.ts': 'ts'
  },
  target: 'node18',
  tsconfig: 'tsconfig.server.json',
  sourcemap: true,
  minify: false, // Keep readable for debugging in production
  keepNames: true,
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};