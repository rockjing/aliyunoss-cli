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
      '--credentials',
      './credentials.json',
      '--profile=prod',
      '--log-level',
      'debug'
    ]);

    expect(parsed.command).toBe('validate-config');
    expect(parsed.options.json).toBe(true);
    expect(parsed.options.configFile).toBe('./config.json');
    expect(parsed.options.credentialsFile).toBe('./credentials.json');
    expect(parsed.options.profile).toBe('prod');
    expect(parsed.options.logLevel).toBe('debug');
  });

  it('parses command value options for OSS commands', () => {
    const parsed = parseCliArgs([
      'upload',
      './report.pdf',
      '--key',
      'documents/report.pdf',
      '--content-type=application/pdf'
    ]);

    expect(parsed.command).toBe('upload');
    expect(parsed.positionals).toEqual(['./report.pdf']);
    expect(parsed.commandOptions['--key']).toBe('documents/report.pdf');
    expect(parsed.commandOptions['--content-type']).toBe('application/pdf');
  });

  it('parses delete list file option and global delete guards', () => {
    const parsed = parseCliArgs(['delete-many', '--file', './delete-list.txt', '--dry-run', '--yes']);

    expect(parsed.command).toBe('delete-many');
    expect(parsed.commandOptions['--file']).toBe('./delete-list.txt');
    expect(parsed.options.dryRun).toBe(true);
    expect(parsed.options.yes).toBe(true);
  });

  it('throws argument errors for missing option values', () => {
    expect(() => parseCliArgs(['--config'])).toThrow(CliError);
    expect(() => parseCliArgs(['--credentials'])).toThrow(CliError);
    expect(() => parseCliArgs(['--profile='])).toThrow(CliError);
  });

  it('lets base commands reject unexpected command-specific arguments', () => {
    const parsed = parseCliArgs(['version', '--unknown', 'extra']);

    expect(() => ensureNoExtraArgs(parsed, 'version')).toThrow(CliError);
  });
});
