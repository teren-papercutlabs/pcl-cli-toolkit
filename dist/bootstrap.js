/**
 * Sets up Commander with exitOverride(), name, description.
 * Returns the program for chaining.
 */
export function bootstrap(program, opts) {
    program.name(opts.name);
    if (opts.description)
        program.description(opts.description);
    if (opts.version)
        program.version(opts.version);
    program.exitOverride();
    return program;
}
/**
 * Wraps parseAsync() with unhandled rejection catching,
 * Commander help/version handling, and clean exit codes.
 */
export function runCli(main) {
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
        .catch((error) => {
        // Handle Commander help/version display gracefully
        const err = error;
        if (err?.code === 'commander.helpDisplayed' || err?.code === 'commander.version') {
            return; // exitCode defaults to 0
        }
        console.error(JSON.stringify({ ok: false, error: String(err?.message || error) }));
        process.exitCode = 1;
    });
}
//# sourceMappingURL=bootstrap.js.map