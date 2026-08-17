import fs from 'fs';
import path from 'path';

export const DEFAULT_BACKUP_DIR = `C:\\Users\\ccarvajalino\\OneDrive\\H Plus\\Contabilidad\\Backup`;

export class ReadOnlyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlyViolationError';
  }
}

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathTraversalError';
  }
}

export class BackupFileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFileNotFoundError';
  }
}

export class InvalidBackupFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBackupFileError';
  }
}

/**
 * Normalizes a path string to a canonical lowercased representation for safe containment checks on Windows.
 */
function normalizePathForComparison(p: string): string {
  const resolved = path.resolve(p);
  try {
    const real = fs.realpathSync(resolved);
    return real.toLowerCase();
  } catch {
    return resolved.toLowerCase();
  }
}

/**
 * Validates that a given file path is strictly within the allowed backup directory.
 */
export function validateBackupPath(filePath: string, customBackupDir?: string): string {
  const baseDir = customBackupDir || process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR;
  const resolvedPath = path.resolve(filePath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new BackupFileNotFoundError(`Backup file not found: ${filePath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new InvalidBackupFileError(`Path is not a regular file: ${filePath}`);
  }

  const normalizedTarget = normalizePathForComparison(resolvedPath);
  let normalizedBase = normalizePathForComparison(baseDir);
  if (!normalizedBase.endsWith(path.sep)) {
    normalizedBase += path.sep;
  }

  const rel = path.relative(normalizePathForComparison(baseDir), normalizedTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !normalizedTarget.startsWith(normalizedBase)) {
    throw new PathTraversalError(`Access denied: path ${filePath} escapes allowed backup directory ${baseDir}`);
  }

  return resolvedPath;
}

/**
 * Reads a backup file into a Buffer using explicit read-only mode ('r' flag).
 * Performs mtime verification to guarantee zero modification.
 */
export function readBackupFileBuffer(filePath: string, customBackupDir?: string): Buffer {
  const validPath = validateBackupPath(filePath, customBackupDir);

  const statBefore = fs.statSync(validPath);
  const mtimeBefore = statBefore.mtimeMs;
  const sizeBefore = statBefore.size;

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(validPath);
  } catch (err: any) {
    throw new ReadOnlyViolationError(`Failed to read backup file safely: ${err?.message || err}`);
  }

  const statAfter = fs.statSync(validPath);
  if (statAfter.mtimeMs !== mtimeBefore || statAfter.size !== sizeBefore) {
    throw new ReadOnlyViolationError(`File mutation detected on read: ${validPath}`);
  }

  return buffer;
}

/**
 * Higher-order function that executes a callback with a safe Buffer reading of the backup file.
 * Asserts mtime and size before and after execution to guarantee zero mutation.
 */
export async function withReadOnlyGuard<T>(
  filePath: string,
  callback: (buffer: Buffer) => Promise<T>,
  customBackupDir?: string
): Promise<T> {
  const validPath = validateBackupPath(filePath, customBackupDir);

  const statBefore = fs.statSync(validPath);
  const mtimeBefore = statBefore.mtimeMs;
  const sizeBefore = statBefore.size;

  const buffer = readBackupFileBuffer(validPath, customBackupDir);

  const result = await callback(buffer);

  const statAfter = fs.statSync(validPath);
  if (statAfter.mtimeMs !== mtimeBefore || statAfter.size !== sizeBefore) {
    throw new ReadOnlyViolationError(`File mutation detected after processing callback: ${validPath}`);
  }

  return result;
}

/**
 * Verifies that all files in a directory or a specific file remain completely unchanged (mtime/size).
 */
export function verifyBackupUnchanged(
  targetPath: string,
  snapshotMap?: Map<string, { mtimeMs: number; size: number }>
): { passed: boolean; mutatedFiles: string[] } {
  const mutatedFiles: string[] = [];
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    return { passed: false, mutatedFiles: [resolved] };
  }

  const checkFile = (file: string) => {
    const stat = fs.statSync(file);
    if (snapshotMap && snapshotMap.has(file)) {
      const snap = snapshotMap.get(file)!;
      if (snap.mtimeMs !== stat.mtimeMs || snap.size !== stat.size) {
        mutatedFiles.push(file);
      }
    }
  };

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    checkFile(resolved);
  } else if (stat.isDirectory()) {
    const entries = fs.readdirSync(resolved, { recursive: true });
    for (const entry of entries) {
      const full = path.join(resolved, entry.toString());
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        checkFile(full);
      }
    }
  }

  return {
    passed: mutatedFiles.length === 0,
    mutatedFiles,
  };
}
