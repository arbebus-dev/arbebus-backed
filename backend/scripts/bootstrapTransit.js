require('dotenv').config();
const { spawnSync } = require('child_process');
const path = require('path');

const schemaScript = path.resolve(__dirname, './applySchema.js');
const importScript = path.resolve(__dirname, './importGtfs.js');
const source = process.argv[2];

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run(schemaScript);
run(importScript, source ? [source] : []);
console.log('Transit bootstrap finished');
