#!/usr/bin/env node
/**
 * Production startup script for FinanceHub Pro
 * Intelligent TypeScript execution with multiple fallback strategies
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// Set production environment
process.env.NODE_ENV = 'production';

console.log('🚀 Starting FinanceHub Pro in production mode...');

// PRODUCTION STARTUP DIAGNOSTIC LOGGING
console.log('🔍 [STARTUP DIAGNOSTIC] Validating production environment...');

// Check critical environment variables at startup script level
console.log('🔍 [STARTUP ENV CHECK] Environment variables:');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'MISSING'}`);
console.log(`  - PORT: ${process.env.PORT || 'MISSING (server will default to 80)'}`);
console.log(`  - DATABASE_URL: ${process.env.DATABASE_URL ? 'PRESENT' : 'MISSING'}`);

// Check execution environment
console.log('🔍 [STARTUP PROCESS] Process information:');
console.log(`  - PID: ${process.pid}`);
console.log(`  - Platform: ${process.platform}`);
console.log(`  - Node version: ${process.version}`);
console.log(`  - Working directory: ${process.cwd()}`);

// Determine the best execution strategy
let command, args;

if (existsSync('./dist/server/index.js')) {
  console.log('📦 Found compiled JavaScript, using compiled version for optimal performance');
  command = 'node';
  args = ['dist/server/index.js'];
} else {
  console.log('📦 Using tsx for direct TypeScript execution');
  command = 'npx';
  args = ['tsx', 'server/index.ts'];
}

console.log(`🔧 Executing: ${command} ${args.join(' ')}`);

// Start the server
const serverProcess = spawn(command, args, {
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
  console.error('Make sure tsx is available or run ./build.sh first');
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