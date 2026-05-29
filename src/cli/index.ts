#!/usr/bin/env node

/**
 * aliyunoss-cli - CLI主入口
 *
 * @fileoverview 注册命令、解析参数并统一处理输出和错误
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import 'dotenv/config';

import { pathToFileURL } from 'url';

import { CliError, CliExitCode, normalizeCliError } from './errors.js';
import { writeError, writeSuccess } from './output.js';
import { parseCliArgs } from './parser.js';
import { createCoreCommands, getHelpText } from './commands/core.js';
import type { CliCommand, ParsedCliArgs } from './types.js';

const commands = createCommandRegistry(createCoreCommands());

export async function main(rawArgs = process.argv.slice(2)): Promise<void> {
  let parsed: ParsedCliArgs | null = null;

  try {
    parsed = parseCliArgs(rawArgs);
    const commandName = parsed.command ?? 'help';
    const command = commands.get(commandName);

    if (!command) {
      throw new CliError(
        'UNKNOWN_COMMAND',
        `未知命令: ${commandName}`,
        CliExitCode.ARGUMENT_ERROR
      );
    }

    const result = await command.run({ parsed });
    writeSuccess(result, parsed.options.json);
    process.exitCode = result.exitCode ?? CliExitCode.SUCCESS;
  } catch (error) {
    const normalizedError = normalizeCliError(error);
    writeError(parsed?.command ?? null, normalizedError, parsed?.options.json ?? hasJsonFlag(rawArgs));
    process.exitCode = normalizedError.exitCode;

    if (!hasJsonFlag(rawArgs) && normalizedError.exitCode === CliExitCode.ARGUMENT_ERROR) {
      process.stderr.write(`\n${getHelpText()}\n`);
    }
  }
}

function createCommandRegistry(commandList: CliCommand[]): Map<string, CliCommand> {
  const registry = new Map<string, CliCommand>();

  for (const command of commandList) {
    registry.set(command.name, command);
    for (const alias of command.aliases ?? []) {
      registry.set(alias, command);
    }
  }

  return registry;
}

function hasJsonFlag(args: string[]): boolean {
  return args.includes('--json');
}

if (isDirectRun()) {
  main().catch((error) => {
    const normalizedError = normalizeCliError(error);
    writeError(null, normalizedError, hasJsonFlag(process.argv.slice(2)));
    process.exitCode = normalizedError.exitCode;
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
