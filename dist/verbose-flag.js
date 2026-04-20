import { Option } from 'commander';
/**
 * Register `-v, --verbose` (and hidden `--json` alias) on a command. Used by
 * `pcl * create` / `register` commands whose default output is ID-only — the
 * flag opts back into the full JSON envelope.
 *
 * Both flags set the same `verbose` property. Action handlers MUST read it
 * via `isVerbose(cmd)` (below) rather than from the `opts` argument, because
 * some programs (e.g. marshal) declare `-v, --verbose` at the ROOT program
 * level for debug-logs mode. Commander parses root-level `--verbose` into the
 * root's opts, not into the subcommand's local opts — so the per-command
 * `opts.verbose` would be `undefined` when the user passes `--verbose`. The
 * `isVerbose` helper merges root and subcommand opts so both paths work.
 *
 * Local registration of `-v, --verbose` on the subcommand is still useful for
 * CLIs whose root program has NO `--verbose` flag (e.g. papercut-os CLIs) —
 * there the local option is active, and `optsWithGlobals()` simply falls back
 * to it.
 *
 *     program
 *       .command('create')
 *       .action(async (opts, cmd) => {
 *         const row = await insert(...);
 *         writeCreateResult(row.id, {...}, { verbose: isVerbose(cmd) });
 *       });
 *     addVerboseFlag(program.commands[program.commands.length - 1]);
 */
export function addVerboseFlag(cmd) {
    cmd.addOption(new Option('-v, --verbose', 'Output full JSON envelope instead of ID only'));
    cmd.addOption(new Option('--json', 'Alias for --verbose')
        .hideHelp()
        .implies({ verbose: true }));
    return cmd;
}
/**
 * True when the command (or any ancestor program) has `--verbose` set, or the
 * hidden `--json` alias was passed. Merges opts across the whole Commander
 * tree via `optsWithGlobals()`.
 */
export function isVerbose(cmd) {
    const all = cmd.optsWithGlobals();
    return Boolean(all.verbose || all.json);
}
//# sourceMappingURL=verbose-flag.js.map