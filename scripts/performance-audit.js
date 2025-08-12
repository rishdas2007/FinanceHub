#!/usr/bin/env node

/**
 * Performance Audit Script
 * Validates the bulk endpoint implementation and measures key metrics
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const BULK_ENDPOINT = '/api/v2/etf-metrics?bulk=true';

async function auditBulkEndpoint() {
  console.log('🔍 Starting performance audit...\n');

  // Test 1: Response time
  const start = performance.now();
  const response = await fetch(`${BASE_URL}${BULK_ENDPOINT}`);
  const duration = performance.now() - start;
  
  console.log(`⚡ Response Time: ${duration.toFixed(1)}ms`);
  console.log(`📊 Status: ${response.status}`);
  console.log(`🎯 Target: <200ms (${duration < 200 ? '✅ PASS' : '❌ FAIL'})`);

  // Test 2: Headers validation
  const etag = response.headers.get('etag');
  const cacheControl = response.headers.get('cache-control');
  const contentType = response.headers.get('content-type');
  
  console.log(`\n📋 Headers Audit:`);
  console.log(`  ETag: ${etag ? '✅' : '❌'} ${etag || 'Missing'}`);
  console.log(`  Cache-Control: ${cacheControl ? '✅' : '❌'} ${cacheControl || 'Missing'}`);
  console.log(`  Content-Type: ${contentType ? '✅' : '❌'} ${contentType || 'Missing'}`);

  // Test 3: Payload validation
  const data = await response.json();
  const hasVersion = data.version;
  const hasUpdatedAt = data.updatedAt;
  const itemsCount = data.items?.length || 0;
  
  console.log(`\n📦 Payload Audit:`);
  console.log(`  Version: ${hasVersion ? '✅' : '❌'} ${hasVersion || 'Missing'}`);
  console.log(`  UpdatedAt: ${hasUpdatedAt ? '✅' : '❌'} ${hasUpdatedAt || 'Missing'}`);
  console.log(`  Items Count: ${itemsCount > 0 ? '✅' : '❌'} ${itemsCount}`);

  // Test 4: ETag conditional request
  if (etag) {
    const conditionalStart = performance.now();
    const conditionalResponse = await fetch(`${BASE_URL}${BULK_ENDPOINT}`, {
      headers: { 'If-None-Match': etag }
    });
    const conditionalDuration = performance.now() - conditionalStart;
    
    console.log(`\n🔄 Conditional Request:`);
    console.log(`  Status: ${conditionalResponse.status === 304 ? '✅ 304' : '❌ ' + conditionalResponse.status}`);
    console.log(`  Duration: ${conditionalDuration.toFixed(1)}ms`);
  }

  // Test 5: Multiple requests performance
  console.log(`\n⚡ Load Test (5 concurrent requests):`);
  const loadTestPromises = Array.from({ length: 5 }, () => {
    const requestStart = performance.now();
    return fetch(`${BASE_URL}${BULK_ENDPOINT}`)
      .then(() => performance.now() - requestStart);
  });
  
  const loadTestResults = await Promise.all(loadTestPromises);
  const avgLoadTime = loadTestResults.reduce((a, b) => a + b, 0) / loadTestResults.length;
  
  console.log(`  Average: ${avgLoadTime.toFixed(1)}ms`);
  console.log(`  Range: ${Math.min(...loadTestResults).toFixed(1)}ms - ${Math.max(...loadTestResults).toFixed(1)}ms`);
  console.log(`  All under 200ms: ${loadTestResults.every(t => t < 200) ? '✅ PASS' : '❌ FAIL'}`);

  console.log(`\n🎉 Performance audit complete!`);
}

auditBulkEndpoint().catch(console.error);