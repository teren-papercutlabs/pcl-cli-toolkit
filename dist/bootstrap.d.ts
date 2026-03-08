import { Command } from 'commander';
interface BootstrapOptions {
    name: string;
    description?: string;
    version?: string;
}
/**
 * Sets up Commander with exitOverride(), name, description, and a structured
 * error handler that emits JSON envelopes for unknown option/command errors.
 * Returns the program for chaining.
 */
export declare function bootstrap(program: Command, opts: BootstrapOptions): Command;
/**
 * Registers hidden flag aliases that AI agents commonly pass to PcL CLIs.
 * These are no-ops — all PcL CLIs output JSON by default, so --json and
 * --format are accepted silently for compatibility.
 *
 * Call this after bootstrap() on the root program to silence
 * "unknown option '--json'" errors in agent-generated commands.
 */
export declare function addAgentAliases(program: Command): void;
/**
 * Wraps parseAsync() with unhandled rejection catching,
 * Commander help/version handling, and clean exit codes.
 */
export declare function runCli(main: () => Promise<void>): void;
export {};
