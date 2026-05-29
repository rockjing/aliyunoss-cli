import { CliError, CliExitCode } from './errors.js';
import { confirmDeletion, formatDeletePreview, type DeleteConfirmationIO } from './confirm.js';

describe('delete confirmation', () => {
  it('allows --yes and dry-run without prompting', async () => {
    const io = createIO({ isTTY: false, answer: '' });

    await expect(confirmDeletion(createRequest({ yes: true }), io)).resolves.toBeUndefined();
    await expect(confirmDeletion(createRequest({ dryRun: true }), io)).resolves.toBeUndefined();
    expect(io.question).not.toHaveBeenCalled();
  });

  it('rejects non-interactive deletes without --yes', async () => {
    const io = createIO({ isTTY: false, answer: '' });

    await expect(confirmDeletion(createRequest(), io)).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      exitCode: CliExitCode.ARGUMENT_ERROR
    });
    expect(io.question).not.toHaveBeenCalled();
  });

  it('accepts exact single object key confirmation', async () => {
    const io = createIO({ isTTY: true, answer: 'documents/report.pdf' });

    await expect(confirmDeletion(createRequest(), io)).resolves.toBeUndefined();
    expect(io.write).toHaveBeenCalledWith(expect.stringContaining('Bucket: example-bucket'));
  });

  it('returns 130 when the user cancels', async () => {
    const io = createIO({ isTTY: true, answer: 'no' });

    await expect(confirmDeletion(createRequest(), io)).rejects.toMatchObject({
      code: 'USER_CANCELLED',
      exitCode: CliExitCode.CANCELLED
    });
  });

  it('formats delete-many preview with samples', () => {
    const preview = formatDeletePreview(createRequest({
      operation: 'delete-many',
      keys: ['a.txt', 'b.txt', 'c.txt'],
      dryRun: true,
      sampleSize: 2
    }));

    expect(preview).toContain('Delete dry run');
    expect(preview).toContain('Count: 3');
    expect(preview).toContain('a.txt');
    expect(preview).toContain('... and 1 more');
  });
});

function createRequest(overrides = {}) {
  return {
    operation: 'delete' as const,
    bucket: 'example-bucket',
    region: 'oss-cn-hangzhou',
    keys: ['documents/report.pdf'],
    yes: false,
    dryRun: false,
    ...overrides
  };
}

function createIO(options: { isTTY: boolean; answer: string }): DeleteConfirmationIO {
  return {
    isTTY: options.isTTY,
    write: jest.fn(),
    question: jest.fn(async () => options.answer)
  };
}
