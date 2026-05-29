/**
 * aliyunoss-cli - 参数解析
 *
 * @fileoverview 轻量解析全局参数、命令和预留命令参数
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { CliError, CliExitCode } from './errors.js';
import type { CliOptions, ParsedCliArgs } from './types.js';

const VALUE_OPTIONS = new Set([
  '--config',
  '--profile',
  '--log-level',
  '--key',
  '--expires',
  '--prefix',
  '--max-keys',
  '--marker',
  '--delimiter',
  '--content-type',
  '--storage-class'
]);

export function parseCliArgs(args: string[]): ParsedCliArgs {
  const options: CliOptions = {
    json: false,
    help: false,
    version: false,
    stdio: false,
    validateConfig: false,
    health: false,
    yes: false,
    dryRun: false
  };
  const commandOptions: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (arg === '--') {
      positionals.push(...args.slice(index + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const consumed = consumeOption(args, index, options, commandOptions);
      index += consumed;
      continue;
    }

    if (arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '-v') {
      options.version = true;
      continue;
    }

    positionals.push(arg);
  }

  const command = normalizeCommand(positionals.shift() ?? null, options);

  return {
    command,
    positionals,
    options,
    commandOptions,
    rawArgs: [...args]
  };
}

export function ensureNoExtraArgs(parsed: ParsedCliArgs, commandName: string): void {
  const extraOptionNames = Object.keys(parsed.commandOptions);
  if (extraOptionNames.length > 0) {
    throw new CliError(
      'UNKNOWN_OPTION',
      `${commandName} 不支持参数: ${extraOptionNames.join(', ')}`,
      CliExitCode.ARGUMENT_ERROR
    );
  }

  if (parsed.positionals.length > 0) {
    throw new CliError(
      'UNEXPECTED_ARGUMENT',
      `${commandName} 不支持位置参数: ${parsed.positionals.join(', ')}`,
      CliExitCode.ARGUMENT_ERROR
    );
  }
}

function consumeOption(
  args: string[],
  index: number,
  options: CliOptions,
  commandOptions: Record<string, string | boolean>
): number {
  const rawOption = args[index] ?? '';
  const separatorIndex = rawOption.indexOf('=');
  const name = separatorIndex >= 0 ? rawOption.slice(0, separatorIndex) : rawOption;
  const inlineValue = separatorIndex >= 0 ? rawOption.slice(separatorIndex + 1) : undefined;

  switch (name) {
    case '--json':
      options.json = true;
      return 0;
    case '--help':
      options.help = true;
      return 0;
    case '--version':
      options.version = true;
      return 0;
    case '--stdio':
      options.stdio = true;
      return 0;
    case '--validate-config':
      options.validateConfig = true;
      return 0;
    case '--health':
      options.health = true;
      return 0;
    case '--yes':
      options.yes = true;
      return 0;
    case '--dry-run':
      options.dryRun = true;
      return 0;
    case '--config':
      options.configFile = readOptionValue(args, index, name, inlineValue);
      return inlineValue === undefined ? 1 : 0;
    case '--profile':
      options.profile = readOptionValue(args, index, name, inlineValue);
      return inlineValue === undefined ? 1 : 0;
    case '--log-level':
      options.logLevel = readOptionValue(args, index, name, inlineValue);
      return inlineValue === undefined ? 1 : 0;
    default:
      if (VALUE_OPTIONS.has(name)) {
        commandOptions[name] = readOptionValue(args, index, name, inlineValue);
        return inlineValue === undefined ? 1 : 0;
      }
      commandOptions[name] = inlineValue ?? true;
      return 0;
  }
}

function readOptionValue(
  args: string[],
  index: number,
  optionName: string,
  inlineValue: string | undefined
): string {
  if (inlineValue !== undefined) {
    if (inlineValue.length === 0) {
      throw new CliError(
        'MISSING_OPTION_VALUE',
        `${optionName} 需要提供非空值`,
        CliExitCode.ARGUMENT_ERROR
      );
    }

    return inlineValue;
  }

  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new CliError(
      'MISSING_OPTION_VALUE',
      `${optionName} 需要提供值`,
      CliExitCode.ARGUMENT_ERROR
    );
  }

  return value;
}

function normalizeCommand(command: string | null, options: CliOptions): string | null {
  if (options.version && !command) {
    return 'version';
  }

  if (options.help && !command) {
    return 'help';
  }

  if (options.stdio && !command) {
    return 'stdio';
  }

  if (options.validateConfig && !command) {
    return 'validate-config';
  }

  if (options.health && !command) {
    return 'health';
  }

  return command;
}
