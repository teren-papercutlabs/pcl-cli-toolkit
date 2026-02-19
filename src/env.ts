import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * Load environment variables from multiple dotenv files.
 * Suppresses dotenv's stdout debug output. Tolerates missing files.
 */
export function loadEnv(paths: string[]): void {
  const origLog = console.log;
  console.log = () => {};

  try {
    for (const p of paths) {
      const resolved = p.startsWith('~')
        ? path.join(process.env.HOME || '', p.slice(1))
        : path.resolve(p);
      if (fs.existsSync(resolved)) {
        dotenv.config({ path: resolved });
      }
    }
  } finally {
    console.log = origLog;
  }
}
