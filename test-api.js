#!/usr/bin/env node

// Test script to verify Harmonic API key and endpoints
const API_KEY = process.argv[2];

if (!API_KEY) {
  console.log('Usage: node test-api.js YOUR_API_KEY');
  process.exit(1);
}

async function testAPI() {
  console.log('Testing Harmonic API...\n');
  
  // Test 1: Search companies
  console.log('1. Testing company search...');
  try {
    const response = await fetch('https://api.harmonic.ai/companies?q=google&limit=1', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const error = await response.text();
      console.log(`   Error: ${error}`);
    } else {
      const data = await response.json();
      console.log(`   Success! Found ${data.length || 0} results`);
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
  }
  
  // Test 2: Check different auth header formats
  console.log('\n2. Testing alternative auth formats...');
  
  const authFormats = [
    `Bearer ${API_KEY}`,
    `Token ${API_KEY}`,
    API_KEY
  ];
  
  for (const authHeader of authFormats) {
    console.log(`   Trying: ${authHeader.substring(0, 20)}...`);
    try {
      const response = await fetch('https://api.harmonic.ai/companies?q=test&limit=1', {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log(`   ✓ Success with format: ${authHeader.split(' ')[0] || 'Direct'}`);
        break;
      } else {
        console.log(`   ✗ Failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ✗ Error: ${error.message}`);
    }
  }
}

testAPI().catch(console.error);