import { Command, Option } from 'commander';
import { finished } from 'node:stream/promises';
import { writeErrorEnvelope } from './envelope.js';

interface BootstrapOptions {
  name: string;
  description?: string;
  version?: string;
}

/** Collect non-hidden long/short flags from the most specific matching command. */
function collectValidFlags(program: Command): string[] {
  const activeCmd = findActiveCommand(program);
  return activeCmd.options
    .filter((opt) => !opt.hidden)
    .map((opt) => opt.long ?? opt.short ?? '')
    .filter(Boolean);
}

/**
 * Walk the command tree to find the subcommand matching process.argv,
 * falling back to the program root when no subcommand is found.
 */
function findActiveCommand(program: Command): Command {
  const args = process.argv.slice(2);
  for (const cmd of program.commands) {
    if (args.includes(cmd.name())) {
      return cmd;
    }
  }
  return program;
}

/** Known-wrong flags that agents commonly try. */
function findHint(flag: string): string | undefined {
  const hints: Record<string, string> = {
    '--json': 'Output is already JSON by default. Remove this flag.',
    '--format': 'Output is always JSON. No format flag needed.',
    '--verbose': 'Use --debug for verbose output if available.',
  };
  return hints[flag];
}

/**
 * Sets up Commander with exitOverride(), name, description, and a structured
 * error handler that emits JSON envelopes for unknown option/command errors.
 * Returns the program for chaining.
 */
export function bootstrap(program: Command, opts: BootstrapOptions): Command {
  program.name(opts.name);
  if (opts.description) program.description(opts.description);
  if (opts.version) program.version(opts.version);
  program.exitOverride();

  // Intercept Commander errors and emit structured JSON to stdout.
  // Commander writes error text to stderr via outputError(); we replace that
  // path for recognised error patterns so agents get machine-readable output.
  program.configureOutput({
    outputError: (str: string, write: (str: string) => void) => {
      // Unknown option: error: unknown option '--json'
      const unknownOptionMatch = str.match(/error: unknown option '([^']+)'/);
      if (unknownOptionMatch) {
        const badFlag = unknownOptionMatch[1];
        writeErrorEnvelope({
          code: 'UNKNOWN_OPTION',
          message: `Unknown option: ${badFlag}`,
          flag: badFlag,
          hint: findHint(badFlag),
          validFlags: collectValidFlags(program),
        });
        return;
      }

      // Unknown command: error: unknown command 'start-run'
      const unknownCommandMatch = str.match(/error: unknown command '([^']+)'/);
      if (unknownCommandMatch) {
        const badCommand = unknownCommandMatch[1];
        writeErrorEnvelope({
          code: 'UNKNOWN_COMMAND',
          message: `Unknown command: ${badCommand}`,
          command: badCommand,
          validCommands: program.commands.map((c) => c.name()),
        });
        return;
      }

      // All other Commander errors: pass through to stderr unchanged.
      write(str);
    },
  });

  return program;
}

/**
 * Registers hidden flag aliases that AI agents commonly pass to PcL CLIs.
 * These are no-ops — all PcL CLIs output JSON by default, so --json and
 * --format are accepted silently for compatibility.
 *
 * Call this after bootstrap() on the root program to silence
 * "unknown option '--json'" errors in agent-generated commands.
 */
export function addAgentAliases(program: Command): void {
  // --json is a no-op: all PcL CLIs output JSON by default.
  // Accepted silently so agent-generated commands don't error.
  program.addOption(new Option('--json', 'Output JSON (already default — accepted for compatibility)').hideHelp());

  // --format is a no-op: JSON is the only output format.
  program.addOption(new Option('--format <format>', 'Output format (JSON is default — accepted for compatibility)').hideHelp());
}

async function finalizeWritable(stream: NodeJS.WriteStream): Promise<void> {
  if (stream.destroyed || stream.writableFinished) return;

  const finalized = finished(stream, { cleanup: true });
  if (!stream.writableEnded) stream.end();
  await finalized;
}

let forcedExit: Promise<void> | undefined;
let forcedExitCode = 0;

function normalizeExitCode(code: NodeJS.Process['exitCode']): number {
  const numeric = Number(code ?? 0);
  return Number.isInteger(numeric) ? numeric : 1;
}

function exitAfterStreamFinalization(code: number): void {
  forcedExitCode = Math.max(forcedExitCode, code);
  forcedExit ??= (async () => {
    await Promise.allSettled([
      finalizeWritable(process.stdout),
      finalizeWritable(process.stderr),
    ]);
    process.exit(forcedExitCode);
  })();
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
    if (!process.stderr.destroyed && !process.stderr.writableEnded) {
      console.error('Uncaught exception:', error);
    }
    exitAfterStreamFinalization(1);
  });

  main()
    .then(() => {
      // process.exit() is required — Commander/Ink event listeners keep the
      // event loop alive, preventing natural exit. Without this, CLI processes
      // hang indefinitely and exhaust Supabase connection pools.
      //
      // `end()` + `finished()` is the ordering barrier: it completes only
      // after each stream has finalized its already-buffered writes. A
      // follow-up empty write callback is not a barrier for prior data.
      const code = normalizeExitCode(process.exitCode);
      exitAfterStreamFinalization(code);
    })
    .catch((error: unknown) => {
      const err = error as { code?: string; message?: string };
      // Handle Commander help/version display gracefully
      if (err?.code === 'commander.helpDisplayed' || err?.code === 'commander.version') {
        exitAfterStreamFinalization(0);
        return;
      }
      // Skip re-output if error envelope was already written (e.g., requireHumanApproval)
      if (process.exitCode && Number(process.exitCode) > 0) {
        exitAfterStreamFinalization(normalizeExitCode(process.exitCode));
        return;
      }
      console.error(JSON.stringify({ ok: false, error: String(err?.message || error) }));
      exitAfterStreamFinalization(1);
    });
}
