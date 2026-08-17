import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  validateBackupPath,
  readBackupFileBuffer,
  withReadOnlyGuard,
  verifyBackupUnchanged,
  PathTraversalError,
  BackupFileNotFoundError,
  InvalidBackupFileError,
} from './readonly-guard';

describe('ReadOnly Guard Unit Tests', () => {
  let mockBackupDir: string;
  let sampleFilePath: string;
  let sampleContent: string;

  beforeAll(() => {
    mockBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    sampleFilePath = path.join(mockBackupDir, 'test-file.xlsx');
    sampleContent = 'MOCK_EXCEL_BINARY_CONTENT';
    fs.writeFileSync(sampleFilePath, sampleContent);
  });

  afterAll(() => {
    if (fs.existsSync(mockBackupDir)) {
      fs.rmSync(mockBackupDir, { recursive: true, force: true });
    }
  });

  it('validates paths strictly within the backup directory', () => {
    const validated = validateBackupPath(sampleFilePath, mockBackupDir);
    expect(validated).toBe(path.resolve(sampleFilePath));
  });

  it('throws PathTraversalError when attempting directory traversal outside backup directory', () => {
    const traversalPath = path.join(mockBackupDir, '..', 'outside-file.txt');
    expect(() => validateBackupPath(traversalPath, mockBackupDir)).toThrow(
      PathTraversalError
    );
  });

  it('throws PathTraversalError when accessing file in a sibling directory with matching prefix (e.g. Backup_Malicious)', () => {
    const maliciousDir = mockBackupDir + '_Malicious';
    fs.mkdirSync(maliciousDir, { recursive: true });
    const maliciousFile = path.join(maliciousDir, 'file.xlsx');
    fs.writeFileSync(maliciousFile, 'MALICIOUS_CONTENT');
    try {
      expect(() => validateBackupPath(maliciousFile, mockBackupDir)).toThrow(
        PathTraversalError
      );
    } finally {
      if (fs.existsSync(maliciousDir)) {
        fs.rmSync(maliciousDir, { recursive: true, force: true });
      }
    }
  });

  it('throws BackupFileNotFoundError when target file does not exist', () => {
    const missingFile = path.join(mockBackupDir, 'non-existent.xlsx');
    expect(() => validateBackupPath(missingFile, mockBackupDir)).toThrow(
      BackupFileNotFoundError
    );
  });

  it('throws InvalidBackupFileError when target path is a directory', () => {
    expect(() => validateBackupPath(mockBackupDir, mockBackupDir)).toThrow(
      InvalidBackupFileError
    );
  });

  it('reads backup file into a Buffer safely', () => {
    const buf = readBackupFileBuffer(sampleFilePath, mockBackupDir);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.toString()).toBe(sampleContent);
  });

  it('executes callback with read-only buffer under withReadOnlyGuard', async () => {
    const result = await withReadOnlyGuard(
      sampleFilePath,
      async (buf) => {
        expect(buf.toString()).toBe(sampleContent);
        return 'SUCCESS';
      },
      mockBackupDir
    );

    expect(result).toBe('SUCCESS');
  });

  it('verifies that files remain unchanged', () => {
    const stat = fs.statSync(sampleFilePath);
    const snapshotMap = new Map();
    snapshotMap.set(sampleFilePath, { mtimeMs: stat.mtimeMs, size: stat.size });

    const check = verifyBackupUnchanged(sampleFilePath, snapshotMap);
    expect(check.passed).toBe(true);
    expect(check.mutatedFiles).toHaveLength(0);
  });
});
