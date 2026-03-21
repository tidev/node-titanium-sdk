import { isDir } from '../../src/util/is-dir.js';
import {
	createTempDir,
	createTempDirName,
	createTempDirPath,
	createTempDirSync,
} from '../../src/util/temp.js';
import { rm } from 'node:fs/promises';
import { basename, isAbsolute } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('createTempDirName', () => {
	it('should create a temporary directory name', () => {
		expect(createTempDirName()).toMatch(/^[0-9a-f]{32}$/);
	});
});

describe('createTempDirPath', () => {
	it('should create a temporary directory path', () => {
		const path = createTempDirPath();
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toMatch(/^[0-9a-f]{32}$/);
	});

	it('should create a temporary directory path with a prefix', () => {
		const path = createTempDirPath({ prefix: 'test' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toMatch(/^test-[0-9a-f]{32}$/);
	});

	it('should create a temporary directory path with a suffix', () => {
		const path = createTempDirPath({ suffix: 'test' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toMatch(/^[0-9a-f]{32}-test$/);
	});

	it('should create a temporary directory path with a prefix and suffix', () => {
		const path = createTempDirPath({ prefix: 'test', suffix: 'test' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toMatch(/^test-[0-9a-f]{32}-test$/);
	});
});

let tmpDir: string | undefined = undefined;

describe('createTempDir', () => {
	afterEach(async () => {
		if (tmpDir) {
			await rm(tmpDir, { force: true, recursive: true });
			tmpDir = undefined;
		}
	});

	it('should create a temporary directory', async () => {
		tmpDir = await createTempDir();
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^[0-9a-f]{32}$/);
	});

	it('should create a temporary directory with a prefix', async () => {
		tmpDir = await createTempDir({ prefix: 'test' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^test-[0-9a-f]{32}$/);
	});

	it('should create a temporary directory with a suffix', async () => {
		tmpDir = await createTempDir({ suffix: 'test' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^[0-9a-f]{32}-test$/);
	});

	it('should create a temporary directory with a prefix and suffix', async () => {
		tmpDir = await createTempDir({ prefix: 'test', suffix: 'test' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^test-[0-9a-f]{32}-test$/);
	});
});

describe('createTempDirSync', () => {
	afterEach(async () => {
		if (tmpDir) {
			await rm(tmpDir, { force: true, recursive: true });
			tmpDir = undefined;
		}
	});

	it('should create a temporary directory synchronously', () => {
		tmpDir = createTempDirSync();
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^[0-9a-f]{32}$/);
	});

	it('should create a temporary directory with a prefix synchronously', () => {
		tmpDir = createTempDirSync({ prefix: 'test' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^test-[0-9a-f]{32}$/);
	});

	it('should create a temporary directory with a suffix synchronously', () => {
		tmpDir = createTempDirSync({ suffix: 'test' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^[0-9a-f]{32}-test$/);
	});

	it('should create a temporary directory with a prefix and suffix synchronously', () => {
		tmpDir = createTempDirSync({ prefix: 'test', suffix: 'test' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^test-[0-9a-f]{32}-test$/);
	});
});
