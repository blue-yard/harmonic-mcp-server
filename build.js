import esbuild from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('Building Harmonic MCP Server...');

  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }

  // Build the TypeScript code into a CommonJS bundle for pkg
  await esbuild.build({
    entryPoints: ['src/harmonic-mcp.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/harmonic-mcp.cjs',
    format: 'cjs',
    banner: {
      js: '#!/usr/bin/env node\n',
    },
    external: [],
    minify: true,
  });

  // Create package.json for pkg
  const pkgConfig = {
    name: "harmonic-mcp",
    version: "1.0.0",
    main: "harmonic-mcp.cjs",
    bin: "harmonic-mcp.cjs",
    pkg: {
      targets: ["node18-macos-x64", "node18-linux-x64", "node18-win-x64"],
      outputPath: "bin"
    }
  };

  fs.writeFileSync('dist/package.json', JSON.stringify(pkgConfig, null, 2));

  // Copy the built file and create binaries with pkg
  console.log('Creating binaries with pkg...');
  
  process.chdir('dist');
  
  try {
    execSync('npx pkg . --out-path ../bin', { stdio: 'inherit' });
    console.log('Build complete! Binaries available in bin/ directory');
  } catch (error) {
    console.error('Failed to create binaries:', error);
  } finally {
    process.chdir('..');
  }
}

build().catch(console.error);