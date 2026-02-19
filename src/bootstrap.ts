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
      // Let Node exit naturally — process.exitCode is already set by callers
    })
    .catch((error: unknown) => {
      // Handle Commander help/version display gracefully
      const err = error as { code?: string; message?: string };
      if (err?.code === 'commander.helpDisplayed' || err?.code === 'commander.version') {
        return; // exitCode defaults to 0
      }
      console.error(JSON.stringify({ ok: false, error: String(err?.message || error) }));
      process.exitCode = 1;
    });
}
