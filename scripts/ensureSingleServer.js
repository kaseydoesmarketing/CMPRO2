import fs from 'fs';
import path from 'path';
import net from 'net';

const PORT = process.env.PORT ? Number(process.env.PORT) : 5020;
const LOCK_PATH = path.resolve(process.cwd(), '.server.lock');

function isPidRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_e) {
    return false;
  }
}

function writeLock() {
  const data = { pid: process.pid, port: PORT, startedAt: new Date().toISOString() };
  fs.writeFileSync(LOCK_PATH, JSON.stringify(data));
}

function removeLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  } catch (_e) {}
}

function ensureSingleInstance() {
  if (fs.existsSync(LOCK_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
      if (prev && prev.pid && isPidRunning(prev.pid)) {
        console.error(`[ensureSingleServer] Another server is already running (pid=${prev.pid})`);
        process.exit(1);
      }
      // stale lock
      removeLock();
    } catch (_e) {
      removeLock();
    }
  }
  writeLock();
  process.on('exit', removeLock);
  process.on('SIGINT', () => { removeLock(); process.exit(0); });
  process.on('SIGTERM', () => { removeLock(); process.exit(0); });
}

async function ensurePortFree() {
  await new Promise((resolve, reject) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
          console.error(`[ensureSingleServer] Port ${PORT} is already in use.`);
          process.exit(1);
        } else {
          reject(err);
        }
      })
      .once('listening', () => {
        tester.close(() => resolve());
      })
      .listen(PORT, '0.0.0.0');
  });
}

await ensurePortFree();
ensureSingleInstance(); 