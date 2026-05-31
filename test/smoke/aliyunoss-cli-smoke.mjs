#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REQUIRED_ENV = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET', 'OSS_REGION'];
const DEFAULT_PREFIX_ROOT = 'aliyunoss-cli-smoke';
const cliPath = resolve(process.env.ALIYUNOSS_CLI_BIN ?? 'build/cli/index.js');
const packageVersion = JSON.parse(readPackageJson()).version;
const runId = new Date().toISOString().replace(/[-:.]/g, '').replace('T', '-').slice(0, 17);
const prefix = normalizePrefix(
  process.env.ALIYUNOSS_SMOKE_PREFIX ?? `${DEFAULT_PREFIX_ROOT}/${runId}-${randomText()}`
);
const createdKeys = new Set();
const tempDir = mkdtempSync(join(tmpdir(), 'aliyunoss-cli-smoke-'));

main().catch((error) => {
  console.error(`\n[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  try {
    assertEnvironment();
    assertBuiltCli();
    assertSafePrefix(prefix);

    console.log(`[INFO] CLI: ${cliPath}`);
    console.log(`[INFO] Bucket: ${process.env.OSS_BUCKET}`);
    console.log(`[INFO] Region: ${process.env.OSS_REGION}`);
    console.log(`[INFO] Prefix: ${prefix}/`);

    runTextCase('CLI-SMOKE-001 help', ['--help'], (result) => {
      assertIncludes(result.stdout, 'delete-many', 'help should include delete-many');
      assertIncludes(result.stdout, 'stdio', 'help should include stdio');
    });

    runTextCase('CLI-SMOKE-002 version', ['version'], (result) => {
      assertEqual(result.stdout.trim(), packageVersion, 'version should match package.json');
    });

    runJsonCase('CLI-SMOKE-003 validate-config', ['validate-config', '--json'], (payload, result) => {
      assertEqual(payload.success, true, 'validate-config should succeed');
      assertNoSecretLeak(result.stdout + result.stderr);
    });

    if (process.env.ALIYUNOSS_SMOKE_SKIP_HEALTH === '1') {
      console.log('[SKIP] CLI-SMOKE-004 health (ALIYUNOSS_SMOKE_SKIP_HEALTH=1)');
    } else {
      runJsonCase('CLI-SMOKE-004 health', ['health', '--json'], (payload) => {
        assertEqual(payload.success, true, 'health command should return a CLI success envelope');
        assert(payload.data?.health, 'health payload should include data.health');
      });
    }

    const localFile = join(tempDir, 'a.txt');
    const deleteList = join(tempDir, 'delete-list.txt');
    const keyA = `${prefix}/a.txt`;
    const keyB = `${prefix}/b.txt`;
    writeFileSync(localFile, `aliyunoss-cli smoke test ${new Date().toISOString()}\n`);

    runJsonCase('CLI-SMOKE-005 upload', ['upload', localFile, '--key', keyA, '--json'], (payload) => {
      assertEqual(payload.success, true, 'upload should succeed');
      assertEqual(payload.data?.key, keyA, 'upload should return the uploaded key');
      createdKeys.add(keyA);
    });

    runJsonCase('CLI-SMOKE-006 list uploaded object', ['list', '--prefix', `${prefix}/`, '--json'], (payload) => {
      assertObjectListed(payload, keyA);
    });

    runJsonCase('CLI-SMOKE-007 meta', ['meta', keyA, '--json'], (payload) => {
      assertEqual(payload.success, true, 'meta should succeed');
      assertEqual(payload.data?.key, keyA, 'meta should return key');
      assert(Number(payload.data?.size) > 0, 'meta size should be greater than zero');
    });

    runJsonCase('CLI-SMOKE-008 url', ['url', keyA, '--expires', '300', '--json'], (payload) => {
      assertEqual(payload.success, true, 'url should succeed');
      assert(String(payload.data?.url).startsWith('http'), 'url should return an http URL');
    });

    runJsonCase('CLI-SMOKE-009 copy', ['copy', keyA, keyB, '--no-overwrite', '--json'], (payload) => {
      assertEqual(payload.success, true, 'copy should succeed');
      assertEqual(payload.data?.target, keyB, 'copy should return target');
      createdKeys.add(keyB);
    });

    runJsonCase('CLI-SMOKE-009 list copied object', ['list', '--prefix', `${prefix}/`, '--json'], (payload) => {
      assertObjectListed(payload, keyA);
      assertObjectListed(payload, keyB);
    });

    runJsonCase('CLI-SMOKE-010 delete dry-run', ['delete', keyA, '--dry-run', '--json'], (payload) => {
      assertEqual(payload.success, true, 'delete dry-run should succeed');
      assertEqual(payload.data?.dryRun, true, 'delete dry-run should return dryRun=true');
    });

    runJsonCase('CLI-SMOKE-010 verify dry-run kept object', ['list', '--prefix', `${prefix}/`, '--json'], (payload) => {
      assertObjectListed(payload, keyA);
    });

    runJsonCase('CLI-SMOKE-011 delete --yes', ['delete', keyA, '--yes', '--json'], (payload) => {
      assertEqual(payload.success, true, 'delete --yes should succeed');
      createdKeys.delete(keyA);
    });

    writeFileSync(deleteList, `${keyB}\n`);

    runJsonCase(
      'CLI-SMOKE-012 delete-many dry-run',
      ['delete-many', '--file', deleteList, '--dry-run', '--json'],
      (payload) => {
        assertEqual(payload.success, true, 'delete-many dry-run should succeed');
        assertEqual(payload.data?.dryRun, true, 'delete-many dry-run should return dryRun=true');
        assertEqual(payload.data?.count, 1, 'delete-many dry-run should include one key');
      }
    );

    runJsonCase('CLI-SMOKE-012 verify dry-run kept batch object', ['list', '--prefix', `${prefix}/`, '--json'], (payload) => {
      assertObjectListed(payload, keyB);
    });

    runJsonCase('CLI-SMOKE-013 delete-many --yes', ['delete-many', '--file', deleteList, '--yes', '--json'], (payload) => {
      assertEqual(payload.success, true, 'delete-many --yes should succeed');
      assertEqual(payload.data?.errorCount, 0, 'delete-many should not return errors');
      createdKeys.delete(keyB);
    });

    runJsonCase('CLI-SMOKE-013 verify prefix empty', ['list', '--prefix', `${prefix}/`, '--json'], (payload) => {
      assertObjectNotListed(payload, keyA);
      assertObjectNotListed(payload, keyB);
    });

    runExpectedFailure('CLI-SMOKE-014 reject traversal key', ['delete', '../bad.txt', '--yes', '--json']);
    runExpectedFailure('CLI-SMOKE-015 reject encoded traversal key', ['delete', '..%2Fbad.txt', '--yes', '--json']);

    runExpectedFailure(
      'CLI-SMOKE-016 reject non-TTY delete without --yes',
      ['delete', `${prefix}/no-confirm.txt`, '--json'],
      (payload, result) => {
        assertEqual(result.status, 2, 'non-TTY confirmation failure should exit 2');
        assertEqual(payload.error?.code, 'CONFIRMATION_REQUIRED', 'error code should be CONFIRMATION_REQUIRED');
      }
    );

    console.log('\n[PASS] aliyunoss-cli smoke test completed');
  } finally {
    cleanupCreatedObjects();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runTextCase(name, args, verify) {
  const result = runCli(args);
  verify(result);
  console.log(`[PASS] ${name}`);
}

function runJsonCase(name, args, verify) {
  const result = runCli(args);
  const payload = parseJson(result.stdout, name);
  verify(payload, result);
  console.log(`[PASS] ${name}`);
}

function runExpectedFailure(name, args, verify = undefined) {
  const result = runCli(args, { expectSuccess: false });
  const payload = parseJson(result.stderr || result.stdout, name);
  assertEqual(payload.success, false, `${name} should return success=false`);
  if (verify) {
    verify(payload, result);
  }
  console.log(`[PASS] ${name}`);
}

function runCli(args, options = {}) {
  const expectSuccess = options.expectSuccess ?? true;
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    env: process.env,
    encoding: 'utf8'
  });

  if (expectSuccess === true && result.status !== 0) {
    throw new Error(
      `Command failed: aliyunoss-cli ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  if (expectSuccess === false && result.status === 0) {
    throw new Error(`Command unexpectedly succeeded: aliyunoss-cli ${args.join(' ')}\nstdout:\n${result.stdout}`);
  }

  return result;
}

function parseJson(text, name) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const jsonStart = trimmed.lastIndexOf('{\n  "success"');
    if (jsonStart >= 0) {
      try {
        return JSON.parse(trimmed.slice(jsonStart));
      } catch (_ignored) {
        // Fall through to the original error with the complete output.
      }
    }

    throw new Error(`${name} did not return valid JSON: ${text}`);
  }
}

function assertEnvironment() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function assertBuiltCli() {
  if (!existsSync(cliPath)) {
    throw new Error(`Built CLI not found: ${cliPath}. Run npm run build first.`);
  }
}

function assertSafePrefix(value) {
  if (!value.startsWith(`${DEFAULT_PREFIX_ROOT}/`)) {
    throw new Error(`Unsafe smoke prefix: ${value}. Prefix must start with ${DEFAULT_PREFIX_ROOT}/`);
  }

  if (value.includes('..') || value.includes('\\') || value.startsWith('/')) {
    throw new Error(`Unsafe smoke prefix: ${value}`);
  }
}

function normalizePrefix(value) {
  return value.replace(/\/+$/g, '');
}

function assertObjectListed(payload, key) {
  const names = getListedNames(payload);
  assert(names.includes(key), `Expected list result to include ${key}; got ${names.join(', ')}`);
}

function assertObjectNotListed(payload, key) {
  const names = getListedNames(payload);
  assert(!names.includes(key), `Expected list result not to include ${key}; got ${names.join(', ')}`);
}

function getListedNames(payload) {
  assertEqual(payload.success, true, 'list should succeed');
  const objects = payload.data?.objects;
  assert(Array.isArray(objects), 'list payload should include data.objects');
  return objects.map((object) => object.name);
}

function assertNoSecretLeak(text) {
  const secret = process.env.OSS_ACCESS_KEY_SECRET;
  if (secret && text.includes(secret)) {
    throw new Error('Output leaked OSS_ACCESS_KEY_SECRET');
  }
}

function cleanupCreatedObjects() {
  if (createdKeys.size === 0) {
    return;
  }

  const cleanupList = join(tempDir, 'cleanup-list.txt');
  writeFileSync(cleanupList, `${Array.from(createdKeys).join('\n')}\n`);
  const result = runCli(['delete-many', '--file', cleanupList, '--yes', '--json'], { expectSuccess: null });
  if (result.status === 0) {
    console.log(`[INFO] Cleanup deleted ${createdKeys.size} object(s)`);
    createdKeys.clear();
    return;
  }

  console.error(`[WARN] Cleanup failed. Please remove objects manually under prefix: ${prefix}/`);
  console.error(result.stderr || result.stdout);
}

function readPackageJson() {
  const result = spawnSync(process.execPath, ['-e', "process.stdout.write(require('node:fs').readFileSync('package.json','utf8'))"], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error('Unable to read package.json');
  }
  return result.stdout;
}

function randomText() {
  return Math.random().toString(36).slice(2, 8);
}

function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}; expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(text, expected, message) {
  if (!text.includes(expected)) {
    throw new Error(`${message}; missing ${expected}`);
  }
}
