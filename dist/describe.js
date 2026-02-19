import { Help } from 'commander';
function describeCommand(cmd) {
    const args = cmd.registeredArguments.map((arg) => ({
        name: arg.name(),
        required: arg.required,
        description: arg.description || undefined,
        variadic: arg.variadic || undefined,
    }));
    const options = cmd.options
        .filter((opt) => !opt.hidden)
        .map((opt) => ({
        name: opt.long || opt.short || '',
        short: opt.short || undefined,
        required: opt.required || false,
        description: opt.description || undefined,
        defaultValue: opt.defaultValue !== undefined ? opt.defaultValue : undefined,
        choices: opt.argChoices || undefined,
    }));
    // Use Commander's Help class to get only visible (non-hidden) subcommands.
    // _hidden is not exposed publicly in Commander 12; visibleCommands() is the official filter.
    const visibleSubs = new Help().visibleCommands(cmd);
    const subcommands = visibleSubs.map(describeCommand);
    return {
        name: cmd.name(),
        description: cmd.description() || undefined,
        args,
        options,
        ...(subcommands.length > 0 ? { subcommands } : {}),
    };
}
/**
 * Generate a machine-readable JSON manifest of all commands, args, and options.
 * Walks the Commander tree recursively.
 */
export function describe(program) {
    const visibleCmds = new Help().visibleCommands(program);
    return {
        name: program.name(),
        description: program.description() || undefined,
        version: program.version() || undefined,
        commands: visibleCmds.map(describeCommand),
    };
}
/**
 * Register a --describe flag on the program that outputs the manifest and exits.
 * Uses program.on('option:describe') so it fires even when no subcommand is given
 * (preAction is only called when a subcommand action runs).
 */
export function registerDescribe(program) {
    program.option('--describe', 'Output machine-readable command manifest as JSON');
    program.on('option:describe', () => {
        process.stdout.write(JSON.stringify(describe(program), null, 2) + '\n');
        process.exit(0);
    });
}
//# sourceMappingURL=describe.js.map