#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Harmonic MCP Server...\n');

const serverPath = path.join(__dirname, 'dist/standalone/index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

server.stdin.write(JSON.stringify(initRequest) + '\n');

// Handle responses
server.stdout.on('data', (data) => {
  console.log('Server response:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('Server log:', data.toString());
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Give it a moment then close
setTimeout(() => {
  console.log('\nTest complete. Closing server...');
  server.kill();
}, 2000);