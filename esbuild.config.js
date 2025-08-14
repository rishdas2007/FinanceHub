// ESBuild configuration for deployment
export default {
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  packages: 'external',
  resolveExtensions: ['.ts', '.js'],
  external: ['@neondatabase/serverless', 'ws', 'drizzle-orm'],
  loader: {
    '.ts': 'ts'
  },
  target: 'node18',
  tsconfig: 'tsconfig.json'
};