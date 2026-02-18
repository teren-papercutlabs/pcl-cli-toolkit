import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { writeErrorEnvelope } from './envelope.js';

interface ReadInputOptions {
  file?: string;
}

/**
 * Read input from a file or stdin. Returns the content as a string.
 * If file is provided, reads from file. Otherwise reads from stdin.
 */
export async function readInput(options: ReadInputOptions = {}): Promise<string> {
  if (options.file) {
    try {
      return readFileSync(options.file, 'utf-8');
    } catch {
      writeErrorEnvelope({
        code: 'FILE_READ_ERROR',
        message: `Failed to read file: ${options.file}`,
      });
      process.exit(1);
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const rl = createInterface({ input: process.stdin, terminal: false });
    rl.on('line', (line) => chunks.push(line));
    rl.on('close', () => resolve(chunks.join('\n')));
    rl.on('error', reject);
  });
}
