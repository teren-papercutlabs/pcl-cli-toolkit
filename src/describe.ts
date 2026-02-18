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

function describeCommand(cmd: Command): CommandDescriptor {
  // Access Commander internals for args (not exposed in public types)
  const rawArgs = (cmd as unknown as { _args: Array<{ name(): string; required: boolean; description: string; variadic: boolean }> })._args ?? [];
  const args: ArgDescriptor[] = rawArgs.map((arg) => ({
    name: arg.name(),
    required: arg.required,
    description: arg.description || undefined,
    variadic: arg.variadic || undefined,
  }));

  const options: OptionDescriptor[] = cmd.options
    .filter((opt) => !(opt as unknown as { hidden?: boolean }).hidden)
    .map((opt) => {
      const o = opt as unknown as {
        long?: string; short?: string; required: boolean;
        description: string; defaultValue?: unknown; argChoices?: string[];
      };
      return {
        name: o.long || o.short || '',
        short: o.short || undefined,
        required: o.required || false,
        description: o.description || undefined,
        defaultValue: o.defaultValue !== undefined ? o.defaultValue : undefined,
        choices: o.argChoices || undefined,
      };
    });

  const subcommands: CommandDescriptor[] = cmd.commands
    .filter((sub) => !(sub as unknown as { _hidden?: boolean })._hidden)
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
export function describe(program: Command): CliManifest {
  return {
    name: program.name(),
    description: program.description() || undefined,
    version: program.version() || undefined,
    commands: program.commands
      .filter((cmd) => !(cmd as unknown as { _hidden?: boolean })._hidden)
      .map(describeCommand),
  };
}

/**
 * Register a --describe flag on the program that outputs the manifest and exits.
 */
export function registerDescribe(program: Command): void {
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
