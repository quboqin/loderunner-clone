#!/usr/bin/env node

// Comprehensive deployment test for Lode Runner clone on Vercel

import https from 'https';
import fs from 'fs';

const BASE_URL = 'https://loderunner-clone.vercel.app';

// Test assets that should be available
const testAssets = [
  // Audio files
  { path: '/assets/audio/dig.wav', expectedType: 'audio/wav' },
  { path: '/assets/audio/getGold.wav', expectedType: 'audio/wav' },
  { path: '/assets/audio/dead.wav', expectedType: 'audio/wav' },
  { path: '/assets/audio/pass.wav', expectedType: 'audio/wav' },
  { path: '/assets/audio/fall.wav', expectedType: 'audio/wav' },
  { path: '/assets/audio/goldFinish1.mp3', expectedType: 'audio/mpeg' },
  { path: '/assets/audio/goldFinish2.mp3', expectedType: 'audio/mpeg' },
  { path: '/assets/audio/sounds.json', expectedType: 'application/json' },
  
  // Sprite files
  { path: '/assets/sprites/runner.png', expectedType: 'image/png' },
  { path: '/assets/sprites/guard.png', expectedType: 'image/png' },
  { path: '/assets/sprites/hole.png', expectedType: 'image/png' },
  { path: '/assets/sprites/tiles.png', expectedType: 'image/png' },
  { path: '/assets/sprites/text.png', expectedType: 'image/png' },
  { path: '/assets/sprites/runner.json', expectedType: 'application/json' },
  { path: '/assets/sprites/guard.json', expectedType: 'application/json' },
  
  // Animation files
  { path: '/assets/anims/runner.json', expectedType: 'application/json' },
  { path: '/assets/anims/guard.json', expectedType: 'application/json' },
  { path: '/assets/anims/hole.json', expectedType: 'application/json' },
  
  // Level files
  { path: '/assets/levels/classic.json', expectedType: 'application/json' },
  
  // Image files
  { path: '/assets/images/logo.png', expectedType: 'image/png' },
  { path: '/assets/images/start-screen.png', expectedType: 'image/png' },
  { path: '/assets/images/game-over.png', expectedType: 'image/png' },
];

function testAsset(asset) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${asset.path}`;
    
    https.get(url, (res) => {
      const { statusCode, headers } = res;
      const contentType = headers['content-type'];
      
      const result = {
        path: asset.path,
        statusCode,
        contentType,
        expectedType: asset.expectedType,
        success: statusCode === 200 && (contentType === asset.expectedType || contentType.startsWith(asset.expectedType)),
        size: headers['content-length'] || 'unknown'
      };
      
      // Consume response data to free up memory
      res.on('data', () => {});
      res.on('end', () => resolve(result));
      
    }).on('error', (err) => {
      resolve({
        path: asset.path,
        statusCode: 'ERROR',
        contentType: 'ERROR',
        expectedType: asset.expectedType,
        success: false,
        error: err.message
      });
    });
  });
}

async function runTests() {
  console.log('🚀 Testing Lode Runner Clone Deployment on Vercel\n');
  
  const results = [];
  
  // Test main page first
  console.log('Testing main application...');
  const mainPageResult = await new Promise((resolve) => {
    https.get(BASE_URL, (res) => {
      const { statusCode, headers } = res;
      resolve({
        path: '/',
        statusCode,
        contentType: headers['content-type'],
        success: statusCode === 200
      });
    });
  });
  
  console.log(`Main page: ${mainPageResult.success ? '✅' : '❌'} (${mainPageResult.statusCode})`);
  
  // Test all assets
  console.log('\nTesting game assets...');
  
  for (const asset of testAssets) {
    const result = await testAsset(asset);
    results.push(result);
    
    const status = result.success ? '✅' : '❌';
    const sizeInfo = result.size !== 'unknown' ? ` (${result.size} bytes)` : '';
    
    console.log(`${status} ${asset.path}${sizeInfo}`);
    
    if (!result.success) {
      console.log(`   Expected: ${asset.expectedType}`);
      console.log(`   Got: ${result.contentType} (${result.statusCode})`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\n📊 Results: ${successful}/${total} assets loaded successfully`);
  
  if (successful === total) {
    console.log('🎉 All tests passed! Deployment is successful.');
  } else {
    console.log('⚠️  Some assets failed to load. Check the details above.');
  }
  
  // Performance recommendations
  console.log('\n💡 Performance Analysis:');
  const totalSize = results.reduce((sum, r) => {
    const size = parseInt(r.size) || 0;
    return sum + size;
  }, 0);
  
  if (totalSize > 0) {
    console.log(`Total asset size: ${Math.round(totalSize / 1024)} KB`);
    
    const audioSize = results
      .filter(r => r.path.includes('/audio/'))
      .reduce((sum, r) => sum + (parseInt(r.size) || 0), 0);
    
    console.log(`Audio assets: ${Math.round(audioSize / 1024)} KB`);
    
    if (audioSize > 500000) { // 500KB
      console.log('⚠️  Consider compressing audio files for faster loading');
    }
  }
  
  return successful === total;
}

// Run the tests
runTests().then((success) => {
  process.exit(success ? 0 : 1);
});