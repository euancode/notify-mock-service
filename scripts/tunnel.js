#!/usr/bin/env node
// Starts the mock service locally and exposes it on a public URL via a
// Cloudflare "quick tunnel" - free, no signup, no account required.
// Shells out to the `cloudflared` binary rather than pulling in an npm
// tunnel package, since most of those bundle old/vulnerable dependencies.
//
// Usage: npm run tunnel

const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 3000;

const INSTALL_INSTRUCTIONS = `
cloudflared was not found on your PATH. Install it, then re-run "npm run tunnel":

  macOS:   brew install cloudflared
  Linux:   see https://pkg.cloudflare.com/index.html (apt/yum repo), or download a
           static binary from https://github.com/cloudflare/cloudflared/releases
  Windows: winget install --id Cloudflare.cloudflared
`;

function waitForServer(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      http
        .get(`http://localhost:${port}/healthcheck`, (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve();
          retry();
        })
        .on('error', retry);
      function retry() {
        if (Date.now() > deadline) return reject(new Error('Timed out waiting for the server to start'));
        setTimeout(poll, 300);
      }
    })();
  });
}

async function main() {
  console.log(`Starting notify-mock-service on port ${PORT}...`);
  const server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit',
  });

  const cleanup = () => {
    server.kill();
    if (tunnel) tunnel.kill();
    process.exit();
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  server.on('exit', (code) => {
    if (code !== null && code !== 0) process.exit(code);
  });

  await waitForServer(PORT);
  console.log('Server is up. Starting Cloudflare quick tunnel (no signup required)...');

  var tunnel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`]);

  tunnel.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error(INSTALL_INSTRUCTIONS);
    } else {
      console.error(err.message);
    }
    server.kill();
    process.exit(1);
  });

  let announced = false;
  const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

  const handleOutput = (data) => {
    const text = data.toString();
    process.stderr.write(text);
    if (!announced) {
      const match = text.match(urlPattern);
      if (match) {
        announced = true;
        console.log('\n---');
        console.log(`Public URL: ${match[0]}`);
        console.log(`Dashboard:  ${match[0]}`);
        console.log(`API docs:   ${match[0]}/docs.html`);
        console.log('---\n');
      }
    }
  };

  tunnel.stdout.on('data', handleOutput);
  tunnel.stderr.on('data', handleOutput);

  tunnel.on('exit', (code) => {
    console.log(`cloudflared exited (${code}). Stopping local server.`);
    server.kill();
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
