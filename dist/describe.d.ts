import { Command } from 'commander';
interface ArgDescriptor {
    name: string;
    required: boolean;
    description?: string;
    variadic?: boolean;
}
interface OptionDescriptor {
    name: string;
    short?: string;
    required: boolean;
    description?: string;
    defaultValue?: unknown;
    choices?: string[];
}
interface CommandDescriptor {
    name: string;
    description?: string;
    args: ArgDescriptor[];
    options: OptionDescriptor[];
    subcommands?: CommandDescriptor[];
}
export interface CliManifest {
    name: string;
    description?: string;
    version?: string;
    commands: CommandDescriptor[];
}
/**
 * Generate a machine-readable JSON manifest of all commands, args, and options.
 * Walks the Commander tree recursively.
 */
export declare function describe(program: Command): CliManifest;
/**
 * Register a --describe flag on the program that outputs the manifest and exits.
 * Uses program.on('option:describe') so it fires even when no subcommand is given
 * (preAction is only called when a subcommand action runs).
 */
export declare function registerDescribe(program: Command): void;
export {};
