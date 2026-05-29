import { ErrorCode, MCPError } from '../types/index.js';
import { maskCredential, REDACTED_VALUE, redactSensitiveDetails } from './redaction.js';

describe('sensitive detail redaction', () => {
  it('masks credential identifiers while keeping a short troubleshooting hint', () => {
    expect(maskCredential('LTAI1234567890ABCD')).toBe('LTAI***ABCD');
    expect(maskCredential('short')).toBe(REDACTED_VALUE);
    expect(maskCredential('')).toBe('');
  });

  it('recursively redacts secrets and tokens from plain details', () => {
    const unsafeDetails = {
      config: {
        oss: {
          accessKeyId: 'LTAI1234567890ABCD',
          accessKeySecret: 'super-secret-value',
          stsToken: 'session-token-value'
        }
      }
    };

    const safeDetails = redactSensitiveDetails(unsafeDetails);
    const serialized = JSON.stringify(safeDetails);

    expect(safeDetails.config.oss.accessKeyId).toBe('LTAI***ABCD');
    expect(safeDetails.config.oss.accessKeySecret).toBe(REDACTED_VALUE);
    expect(safeDetails.config.oss.stsToken).toBe(REDACTED_VALUE);
    expect(serialized).not.toContain('super-secret-value');
    expect(serialized).not.toContain('session-token-value');
  });

  it('redacts MCPError details before log serialization', () => {
    const error = new MCPError(ErrorCode.CONFIG_INVALID, 'invalid config', {
      config: {
        oss: {
          accessKeyId: 'LTAI1234567890ABCD',
          accessKeySecret: 'super-secret-value'
        }
      }
    });

    const safeDetails = redactSensitiveDetails({ error });
    const serialized = JSON.stringify(safeDetails);

    expect(serialized).toContain(REDACTED_VALUE);
    expect(serialized).not.toContain('super-secret-value');
  });
});
