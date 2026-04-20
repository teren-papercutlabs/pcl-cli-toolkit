import { Option } from 'commander';
/**
 * Register `-v, --verbose` (and hidden `--json` alias) on a command. Used by
 * `pcl * create` / `register` commands whose default output is ID-only — the
 * flag opts back into the full JSON envelope.
 *
 * Both flags set the same `verbose` property, so action handlers read a
 * single boolean regardless of which the caller used:
 *
 *     .action((opts: { verbose?: boolean }) => {
 *       writeCreateResult(row.id, {...}, { verbose: opts.verbose });
 *     })
 *
 * `--json` is hidden from --help because `--verbose` is the canonical surface.
 * We keep `--json` accepted silently for ergonomic reasons (envelope output
 * IS JSON, so agents naturally reach for it).
 */
export function addVerboseFlag(cmd) {
    cmd.addOption(new Option('-v, --verbose', 'Output full JSON envelope instead of ID only'));
    cmd.addOption(new Option('--json', 'Alias for --verbose')
        .hideHelp()
        .implies({ verbose: true }));
    return cmd;
}
//# sourceMappingURL=verbose-flag.js.map