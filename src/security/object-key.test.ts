import { validateObjectKey, validateObjectPrefix } from './object-key';

describe('object key validation', () => {
  it('allows hierarchical object keys', () => {
    expect(validateObjectKey('documents/report.pdf').valid).toBe(true);
  });

  it.each([
    '',
    '../secret.txt',
    'safe/../secret.txt',
    '..%2Fsecret.txt',
    '%2e%2e/secret.txt',
    '/absolute/path.txt',
    'a//b.txt',
    'a\\b.txt',
    'bad\u0001key.txt',
  ])('rejects unsafe object key %s', key => {
    expect(validateObjectKey(key).valid).toBe(false);
  });

  it('allows empty prefix when no safe prefix is configured', () => {
    expect(validateObjectPrefix('').valid).toBe(true);
  });

  it('honors an allowed prefix option', () => {
    expect(validateObjectKey('uploads/report.pdf', { allowedPrefix: 'uploads/' }).valid).toBe(true);
    expect(validateObjectKey('other/report.pdf', { allowedPrefix: 'uploads/' }).valid).toBe(false);
    expect(validateObjectPrefix('', { allowedPrefix: 'uploads/' }).normalizedKey).toBe('uploads/');
  });
});
