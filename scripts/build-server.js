#!/usr/bin/env node
import esbuild from 'esbuild';
import config from '../esbuild.config.js';

try {
  console.log('Building server...');
  await esbuild.build(config);
  console.log('Server build completed!');
} catch (error) {
  console.error('Server build failed:', error);
  process.exit(1);
}