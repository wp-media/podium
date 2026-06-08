#!/usr/bin/env node
/**
 * Dev orchestrator. Picks a free port for the backend (starting at 4820),
 * then spawns `dev:server` and `dev:client` in parallel using Node's own
 * child_process — no dependency on the concurrently binary.
 */

const net = require("node:net");
const { spawn } = require("node:child_process");

const START = parseInt(process.env.DASHBOARD_PORT || "4820", 10);
const RANGE = 40;

const COLORS = { server: "\x1b[34m", client: "\x1b[32m", reset: "\x1b[0m" };

function probeHost(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    const done = (busy) => { sock.destroy(); resolve(busy); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
    sock.once("timeout", () => done(false));
  });
}

async function busy(port) {
  if (await probeHost("127.0.0.1", port, 600)) return true;
  if (await probeHost("::1", port, 300)) return true;
  return false;
}

async function pickPort() {
  for (let p = START; p < START + RANGE; p++) {
    if (!(await busy(p))) return p;
  }
  throw new Error(`No free port found in ${START}-${START + RANGE - 1}`);
}

function prefix(name, line) {
  const c = COLORS[name] ?? "";
  return `${c}[${name}]${COLORS.reset} ${line}`;
}

function spawnNpm(script, name, env) {
  const child = spawn("npm", ["run", script], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) =>
    d.toString().split("\n").filter(Boolean).forEach((l) => console.log(prefix(name, l)))
  );
  child.stderr.on("data", (d) =>
    d.toString().split("\n").filter(Boolean).forEach((l) => console.error(prefix(name, l)))
  );
  return child;
}

(async () => {
  let port;
  try {
    port = await pickPort();
  } catch (err) {
    console.error(`[dev] ${err.message}`);
    process.exit(1);
  }

  if (port !== START) {
    console.log(`[dev] port ${START} busy; using ${port} instead`);
  } else {
    console.log(`[dev] dashboard server will listen on :${port}`);
  }

  const env = { ...process.env, DASHBOARD_PORT: String(port) };
  const server = spawnNpm("dev:server", "server", env);
  const client = spawnNpm("dev:client", "client", env);

  const kids = [server, client];

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      kids.forEach((k) => { try { k.kill(sig); } catch {} });
    });
  }

  let exited = 0;
  for (const child of kids) {
    child.on("exit", (code, signal) => {
      exited++;
      // Kill the other one too when either exits
      kids.forEach((k) => { try { k.kill("SIGTERM"); } catch {} });
      if (exited === kids.length) process.exit(code || 0);
    });
  }
})();
