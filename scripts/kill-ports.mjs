/**
 * Kills any process listening on the dev ports (dashboard 3000, API 4000).
 * Use when Ctrl+C under turbo leaves orphaned node processes behind.
 *
 *   pnpm stop
 */

import { execSync } from 'node:child_process';

const PORTS = [3000, 4000];
const isWindows = process.platform === 'win32';

function pidsOnPort(port) {
    try {
        if (isWindows) {
            const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
            return [...new Set(out.trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
        }
        const out = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' });
        return out.trim().split(/\s+/).filter(Boolean);
    } catch {
        return [];
    }
}

let killed = 0;
for (const port of PORTS) {
    for (const pid of pidsOnPort(port)) {
        try {
            execSync(isWindows ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`);
            console.log(`✅ Killed PID ${pid} (port ${port})`);
            killed++;
        } catch {
            // process already gone
        }
    }
}

console.log(killed === 0 ? 'ℹ️  No dev servers were running' : `Done - freed ${killed} process(es)`);
