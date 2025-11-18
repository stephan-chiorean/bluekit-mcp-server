#!/usr/bin/env node

import { spawn } from 'child_process';
import * as readline from 'readline';

// Start the MCP server
const server = spawn('node', ['dist/main.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface to read server output
const rl = readline.createInterface({
  input: server.stdout,
  output: process.stdout,
  terminal: false
});

// Wait for initialize message
rl.once('line', (line) => {
  console.log('Server initialized:', line);
  
  // Send a ping tool call
  const pingMessage = {
    type: 'toolCall',
    id: 'test-123',
    name: 'bluekit.ping',
    arguments: {}
  };
  
  console.log('\nSending ping:', JSON.stringify(pingMessage));
  server.stdin.write(JSON.stringify(pingMessage) + '\n');
});

// Read the response
rl.on('line', (line) => {
  if (line.trim()) {
    try {
      const response = JSON.parse(line);
      if (response.type === 'toolResult') {
        console.log('\nReceived response:', JSON.stringify(response, null, 2));
        server.kill();
        process.exit(0);
      }
    } catch (e) {
      // Ignore non-JSON lines
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('close', (code) => {
  console.log(`\nServer process exited with code ${code}`);
  process.exit(code);
});


