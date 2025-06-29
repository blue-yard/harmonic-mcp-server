import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Building Harmonic MCP Server...');

// Clean and create directories
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
}
fs.mkdirSync('dist');

try {
  // Step 1: Compile TypeScript to JavaScript
  console.log('Compiling TypeScript...');
  execSync('npx tsc', { stdio: 'inherit' });
  
  // Step 2: Copy the corrected server
  console.log('Copying Harmonic server...');
  fs.copyFileSync('src/harmonic-server.js', 'dist/harmonic-server.js');
  
  // Step 3: Create a standalone directory with all dependencies
  console.log('Creating standalone package...');
  fs.mkdirSync('dist/standalone');
  
  // Copy the server file
  fs.copyFileSync('dist/harmonic-server.js', 'dist/standalone/index.js');
  
  // Create package.json for the standalone version
  const standalonePackage = {
    name: "harmonic-mcp-server",
    version: "1.0.0",
    main: "index.js",
    bin: {
      "harmonic-mcp": "./index.js"
    },
    dependencies: {
      "@modelcontextprotocol/sdk": "^1.13.1"
    }
  };
  
  fs.writeFileSync('dist/standalone/package.json', JSON.stringify(standalonePackage, null, 2));
  
  // Install dependencies in standalone directory
  console.log('Installing dependencies...');
  execSync('npm install --production', { cwd: path.join(__dirname, 'dist/standalone'), stdio: 'inherit' });
  
  // Make the main file executable
  const mainFile = fs.readFileSync('dist/standalone/index.js', 'utf8');
  // Remove any existing shebang lines
  const cleanedFile = mainFile.replace(/^#!.*\n/gm, '');
  fs.writeFileSync('dist/standalone/index.js', '#!/usr/bin/env node\n' + cleanedFile);
  fs.chmodSync('dist/standalone/index.js', '755');
  
  // Create a simple executable wrapper
  fs.writeFileSync('dist/harmonic-mcp', '#!/usr/bin/env node\nrequire("./standalone/index.js");\n');
  fs.chmodSync('dist/harmonic-mcp', '755');
  
  console.log('\nBuild complete!');
  console.log('Standalone package created in: dist/standalone/');
  console.log('To use directly: ./dist/harmonic-mcp');
  console.log('\nFor Claude Desktop, use the full path to: dist/standalone/index.js');
  
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}