import { CliExitCode } from './errors.js';
import { writeError, writeSuccess } from './output.js';

describe('CLI output', () => {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  let stdout = '';
  let stderr = '';

  beforeEach(() => {
    stdout = '';
    stderr = '';
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout += chunk.toString();
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr += chunk.toString();
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  it('writes successful JSON to stdout with sensitive details redacted', () => {
    writeSuccess(
      {
        command: 'validate-config',
        data: {
          config: {
            oss: {
              accessKeyId: 'LTAI1234567890ABCD',
              accessKeySecret: 'super-secret-value'
            }
          }
        }
      },
      true
    );

    expect(stdout).toContain('"success": true');
    expect(stdout).toContain('"command": "validate-config"');
    expect(stdout).toContain('"accessKeySecret": "***"');
    expect(stdout).not.toContain('super-secret-value');
    expect(stderr).toBe('');
  });

  it('writes error JSON to stderr with stable shape', () => {
    writeError(
      'unknown',
      {
        code: 'UNKNOWN_COMMAND',
        message: '未知命令',
        exitCode: CliExitCode.ARGUMENT_ERROR
      },
      true
    );

    expect(stderr).toContain('"success": false');
    expect(stderr).toContain('"code": "UNKNOWN_COMMAND"');
    expect(stdout).toBe('');
  });
});
