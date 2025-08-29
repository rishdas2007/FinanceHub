#!/usr/bin/env node
/**
 * Production startup script for FinanceHub Pro
 * Uses tsx to run TypeScript directly in production with proper environment settings
 */

import { spawn } from 'child_process';
import path from 'path';

// Set production environment
process.env.NODE_ENV = 'production';

console.log('🚀 Starting FinanceHub Pro in production mode...');
console.log('📦 Using tsx for TypeScript execution');

// Start the server using tsx
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

// Handle process exit
serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Handle errors
serverProcess.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  serverProcess.kill('SIGINT');
});