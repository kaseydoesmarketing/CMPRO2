#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const API = process.env.API || 'http://localhost:5020';
const TARGET_URL = process.env.TARGET_URL || 'https://example.com';
const MODE = (process.env.MODE || 'both').toLowerCase();

const schemaPath = path.resolve(process.cwd(), 'schemas', 'elementor-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
const validateTemplate = ajv.compile(schema);

function ensureArtifactsDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: opts.method || 'GET',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const body = buf.toString('utf8');
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(Buffer.from(opts.body));
    req.end();
  });
}

function fetchBuffer(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: opts.method || 'GET',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${buf.toString('utf8')}`));
        }
        resolve(buf);
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(Buffer.from(opts.body));
    req.end();
  });
}

async function runOnce(iteration) {
  const artifactsDir = path.resolve(process.cwd(), 'artifacts', 'smoke');
  ensureArtifactsDir(artifactsDir);

  const health = await fetchJson(`${API}/api/health`);
  if (!health || health.ok !== true) throw new Error('Health not ok');
  writeJson(path.join(artifactsDir, 'health.json'), health);

  const scan = await fetchJson(`${API}/api/clone/scan`, {
    method: 'POST',
    body: JSON.stringify({ url: TARGET_URL })
  });
  if (!scan || scan.ok !== true || scan.converter !== 'ElementorConverter') {
    throw new Error('Scan failed or wrong converter');
  }
  writeJson(path.join(artifactsDir, 'scan.json'), scan);

  const runTemplate = MODE === 'template' || MODE === 'both';
  const runKit = MODE === 'kit' || MODE === 'both';

  let templateJson = null;

  if (runTemplate) {
    const templateBuffer = await fetchBuffer(`${API}/api/clone/download`, {
      method: 'POST',
      body: JSON.stringify({ url: TARGET_URL, mode: 'template' })
    });
    fs.writeFileSync(path.join(artifactsDir, 'template.json'), templateBuffer);

    templateJson = JSON.parse(templateBuffer.toString('utf8'));
    const valid = validateTemplate(templateJson);
    writeJson(path.join(artifactsDir, 'ajv.log'), {
      ok: valid,
      errors: validateTemplate.errors || null
    });
    if (!valid) {
      const firstError = (validateTemplate.errors || [])[0];
      const message = firstError ? `${firstError.instancePath || '/'} ${firstError.message}` : 'AJV validation failed';
      throw new Error(message);
    }
  }

  if (runKit) {
    const kitBuffer = await fetchBuffer(`${API}/api/clone/download`, {
      method: 'POST',
      body: JSON.stringify({ url: TARGET_URL, mode: 'kit' })
    });
    fs.writeFileSync(path.join(artifactsDir, 'kit.zip'), kitBuffer);
    if ((scan.counts?.images || 0) > 0 && kitBuffer.length < 100 * 1024) {
      throw new Error(`ZIP too small (${kitBuffer.length} bytes) despite images present`);
    }
  }

  if (!runTemplate) {
    writeJson(path.join(artifactsDir, 'ajv.log'), { ok: null, skipped: true });
  }

  return true;
}

(async () => {
  let pass = 0;
  let attempts = 0;
  while (pass < 2 && attempts < 4) {
    attempts += 1;
    try {
      await runOnce(attempts);
      pass += 1;
      console.log(`✅ Smoke iteration ${attempts} passed (${pass}/2)`);
    } catch (e) {
      pass = 0;
      console.error(`❌ Smoke iteration ${attempts} failed:`, e.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (pass < 2) {
    console.error('❌ Smoke failed to pass twice consecutively');
    process.exit(1);
  } else {
    console.log('✅✅ Smoke passed twice consecutively');
  }
})();
