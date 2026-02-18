function describeCommand(cmd) {
    // Access Commander internals for args (not exposed in public types)
    const rawArgs = cmd._args ?? [];
    const args = rawArgs.map((arg) => ({
        name: arg.name(),
        required: arg.required,
        description: arg.description || undefined,
        variadic: arg.variadic || undefined,
    }));
    const options = cmd.options
        .filter((opt) => !opt.hidden)
        .map((opt) => {
        const o = opt;
        return {
            name: o.long || o.short || '',
            short: o.short || undefined,
            required: o.required || false,
            description: o.description || undefined,
            defaultValue: o.defaultValue !== undefined ? o.defaultValue : undefined,
            choices: o.argChoices || undefined,
        };
    });
    const subcommands = cmd.commands
        .filter((sub) => !sub._hidden)
        .map(describeCommand);
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
    return {
        name: program.name(),
        description: program.description() || undefined,
        version: program.version() || undefined,
        commands: program.commands
            .filter((cmd) => !cmd._hidden)
            .map(describeCommand),
    };
}
/**
 * Register a --describe flag on the program that outputs the manifest and exits.
 */
export function registerDescribe(program) {
    program.option('--describe', 'Output machine-readable command manifest as JSON');
    program.hook('preAction', (thisCommand) => {
        const opts = thisCommand.optsWithGlobals();
        if (opts.describe) {
            const manifest = describe(program);
            process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
            process.exit(0);
        }
    });
}
//# sourceMappingURL=describe.js.map