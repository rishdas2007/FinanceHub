#!/usr/bin/env node
/**
 * Production build script for FinanceHub Pro
 * Builds the frontend and prepares the backend for production deployment
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🏗️  Building FinanceHub Pro for production...');

function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n📦 ${description}...`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${description} failed with code ${code}`);
        reject(new Error(`${description} failed`));
      }
    });

    process.on('error', (error) => {
      console.error(`❌ ${description} error:`, error);
      reject(error);
    });
  });
}

async function build() {
  try {
    // Step 1: Generate database types
    await runCommand('npm', ['run', 'db:generate'], 'Generating database types');
    
    // Step 2: Build frontend with Vite
    await runCommand('npx', ['vite', 'build'], 'Building frontend');
    
    // Step 3: Make production start script executable
    if (fs.existsSync('start-production.js')) {
      fs.chmodSync('start-production.js', '755');
      console.log('✅ Production start script made executable');
    }
    
    console.log('\n🎉 Build completed successfully!');
    console.log('🚀 Use "node start-production.js" to run in production');
    
  } catch (error) {
    console.error('\n💥 Build failed:', error.message);
    process.exit(1);
  }
}

build();