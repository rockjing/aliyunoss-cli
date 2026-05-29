import { CliError } from './errors.js';
import { ensureNoExtraArgs, parseCliArgs } from './parser.js';

describe('CLI argument parser', () => {
  it('maps global shortcuts to base commands', () => {
    expect(parseCliArgs(['--help']).command).toBe('help');
    expect(parseCliArgs(['--version']).command).toBe('version');
    expect(parseCliArgs(['--validate-config']).command).toBe('validate-config');
    expect(parseCliArgs(['--health']).command).toBe('health');
    expect(parseCliArgs(['--stdio']).command).toBe('stdio');
  });

  it('parses global options and keeps command arguments for command handlers', () => {
    const parsed = parseCliArgs([
      'validate-config',
      '--json',
      '--config',
      './config.json',
      '--profile=prod',
      '--log-level',
      'debug'
    ]);

    expect(parsed.command).toBe('validate-config');
    expect(parsed.options.json).toBe(true);
    expect(parsed.options.configFile).toBe('./config.json');
    expect(parsed.options.profile).toBe('prod');
    expect(parsed.options.logLevel).toBe('debug');
  });

  it('throws argument errors for missing option values', () => {
    expect(() => parseCliArgs(['--config'])).toThrow(CliError);
    expect(() => parseCliArgs(['--profile='])).toThrow(CliError);
  });

  it('lets base commands reject unexpected command-specific arguments', () => {
    const parsed = parseCliArgs(['version', '--unknown', 'extra']);

    expect(() => ensureNoExtraArgs(parsed, 'version')).toThrow(CliError);
  });
});
