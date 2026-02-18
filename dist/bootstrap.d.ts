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
export declare function bootstrap(program: Command, opts: BootstrapOptions): Command;
/**
 * Wraps parseAsync() with unhandled rejection catching,
 * Commander help/version handling, and clean exit codes.
 */
export declare function runCli(main: () => Promise<void>): void;
export {};
