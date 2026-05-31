import OSS from 'ali-oss';

import { OSSStorageService } from './oss-storage.js';
import { StorageClass, type StorageConfig } from '../types/storage.js';

jest.mock('ali-oss', () => jest.fn());

const MockedOSS = OSS as unknown as jest.Mock;

describe('OSSStorageService metadata', () => {
  const config: StorageConfig = {
    accessKeyId: 'LTAI1234567890ABCD',
    accessKeySecret: 'super-secret-value',
    bucket: 'example-bucket',
    region: 'oss-cn-hangzhou',
    timeout: 5,
  };

  beforeEach(() => {
    MockedOSS.mockReset();
  });

  it('maps head response headers to object metadata', async () => {
    const head = jest.fn(async () => ({
      res: {
        headers: {
          'content-length': '4072',
          etag: '"31B66C35FE631E9ED7D374E3E9B9CBC3"',
          'last-modified': 'Fri, 29 May 2026 06:05:02 GMT',
          'content-type': 'application/json',
          'x-oss-storage-class': 'IA',
          'x-oss-meta-owner': 'cli-test',
          'cache-control': 'max-age=60',
          expires: 'Fri, 29 May 2026 07:05:02 GMT',
        },
      },
      versionId: 'version-1',
    }));
    MockedOSS.mockImplementation(() => ({ head }));

    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const storage = new OSSStorageService(config, logger);
    const metadata = await storage.getFileMetadata('documents/package.json');

    expect(head).toHaveBeenCalledWith('documents/package.json', { timeout: 5000 });
    expect(metadata).toMatchObject({
      name: 'documents/package.json',
      size: 4072,
      contentType: 'application/json',
      etag: '"31B66C35FE631E9ED7D374E3E9B9CBC3"',
      storageClass: 'IA',
      cacheControl: 'max-age=60',
      metadata: {
        owner: 'cli-test',
      },
      versionId: 'version-1',
    });
    expect(metadata.lastModified.toISOString()).toBe('2026-05-29T06:05:02.000Z');
    expect(metadata.expires?.toISOString()).toBe('2026-05-29T07:05:02.000Z');
  });

  it('creates symlink with normalized absolute paths', async () => {
    const putSymlink = jest.fn(async () => ({
      res: {
        headers: {
          'x-oss-request-id': 'request-1',
          'x-oss-version-id': 'version-link',
        },
      },
    }));
    MockedOSS.mockImplementation(() => ({ putSymlink }));

    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const storage = new OSSStorageService(config, logger);
    const result = await storage.createSymlink('/documents/source.txt', '/shortcuts/latest.txt', {
      forbidOverwrite: true,
      storageClass: StorageClass.STANDARD,
      metadata: {
        owner: 'cli-test',
      },
    });

    expect(putSymlink).toHaveBeenCalledWith('shortcuts/latest.txt', 'documents/source.txt', {
      timeout: 5000,
      headers: {
        'x-oss-forbid-overwrite': 'true',
      },
      storageClass: 'Standard',
      meta: {
        owner: 'cli-test',
      },
    });
    expect(result).toEqual({
      symlink: 'shortcuts/latest.txt',
      target: 'documents/source.txt',
      requestId: 'request-1',
      versionId: 'version-link',
    });
  });
});
