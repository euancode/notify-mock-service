#!/usr/bin/env node
// Creates (or reuses) a Render web service for this repo via the Render REST API,
// as a scriptable alternative to clicking the dashboard's "Deploy to Render" button.
//
// Usage:
//   RENDER_API_KEY=rnd_xxx npm run deploy:render
//
// Optional env vars:
//   RENDER_OWNER_ID  - Render workspace/owner id (required if your account has more than one)
//   RENDER_REPO_URL  - defaults to this repo's `origin` remote
//   RENDER_BRANCH    - defaults to the current git branch

const { execSync } = require('child_process');

const API_BASE = 'https://api.render.com/v1';
const SERVICE_NAME = 'notify-mock-service';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function apiKey() {
  const key = process.env.RENDER_API_KEY;
  if (!key) {
    console.error(
      [
        'Missing RENDER_API_KEY.',
        '',
        '1. Create one at https://dashboard.render.com/u/settings#api-keys',
        '2. Run: RENDER_API_KEY=rnd_xxx npm run deploy:render',
      ].join('\n')
    );
    process.exit(1);
  }
  return key;
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Render API ${options.method || 'GET'} ${path} failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function repoUrl() {
  if (process.env.RENDER_REPO_URL) return process.env.RENDER_REPO_URL;
  const remote = run('git remote get-url origin');
  return remote.replace(/\.git$/, '');
}

function branch() {
  return process.env.RENDER_BRANCH || run('git rev-parse --abbrev-ref HEAD');
}

async function resolveOwnerId() {
  if (process.env.RENDER_OWNER_ID) return process.env.RENDER_OWNER_ID;
  const owners = await api('/owners');
  if (owners.length === 1) return owners[0].owner.id;
  console.error(
    [
      'Multiple Render owners found on this account. Set RENDER_OWNER_ID to one of:',
      ...owners.map((o) => `  ${o.owner.id}  (${o.owner.name || o.owner.email})`),
    ].join('\n')
  );
  process.exit(1);
}

async function findExistingService(ownerId, name) {
  const services = await api(`/services?ownerId=${ownerId}&name=${encodeURIComponent(name)}&limit=20`);
  return services.find((s) => s.service.name === name)?.service || null;
}

async function main() {
  const ownerId = await resolveOwnerId();
  const repo = repoUrl();
  const branchName = branch();

  console.log(`Repo:   ${repo}`);
  console.log(`Branch: ${branchName}`);

  const existing = await findExistingService(ownerId, SERVICE_NAME);
  if (existing) {
    console.log(`Service already exists: ${existing.dashboardUrl || existing.id}`);
    console.log('Triggering a new deploy...');
    await api(`/services/${existing.id}/deploys`, { method: 'POST', body: JSON.stringify({}) });
    console.log('Deploy triggered. Check progress in the Render dashboard.');
    return;
  }

  console.log('Creating new Render web service...');
  const created = await api('/services', {
    method: 'POST',
    body: JSON.stringify({
      type: 'web_service',
      name: SERVICE_NAME,
      ownerId,
      repo,
      branch: branchName,
      autoDeploy: true,
      serviceDetails: {
        env: 'node',
        plan: 'free',
        region: 'oregon',
        healthCheckPath: '/healthcheck',
        envSpecificDetails: {
          buildCommand: 'npm install',
          startCommand: 'npm start',
        },
      },
    }),
  });

  const service = created.service || created;
  console.log('Service created.');
  console.log(`Dashboard: https://dashboard.render.com/web/${service.id}`);
  if (service.serviceDetails && service.serviceDetails.url) {
    console.log(`URL: ${service.serviceDetails.url}`);
  }
  console.log('The first build/deploy is running now — check the dashboard link above for progress.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
