import { Command } from 'commander';

interface BootstrapOptions {
  name: string;
  description?: string;
  version?: string;
}

/**
 * Sets up Commander with exitOverride(), name, description.
 * Returns the program for chaining.
 */
export function bootstrap(program: Command, opts: BootstrapOptions): Command {
  program.name(opts.name);
  if (opts.description) program.description(opts.description);
  if (opts.version) program.version(opts.version);
  program.exitOverride();
  return program;
}

/**
 * Wraps parseAsync() with unhandled rejection catching,
 * Commander help/version handling, and clean exit codes.
 */
export function runCli(main: () => Promise<void>): void {
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exitCode = 1;
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
  });

  main()
    .then(() => {
      // process.exit() is required — Commander/Ink event listeners keep the
      // event loop alive, preventing natural exit. Without this, CLI processes
      // hang indefinitely and exhaust Supabase connection pools.
      process.exit(process.exitCode ?? 0);
    })
    .catch((error: unknown) => {
      const err = error as { code?: string; message?: string };
      // Handle Commander help/version display gracefully
      if (err?.code === 'commander.helpDisplayed' || err?.code === 'commander.version') {
        process.exit(0);
      }
      // Skip re-output if error envelope was already written (e.g., requireHumanApproval)
      if (process.exitCode && Number(process.exitCode) > 0) {
        process.exit(process.exitCode);
      }
      console.error(JSON.stringify({ ok: false, error: String(err?.message || error) }));
      process.exit(1);
    });
}
