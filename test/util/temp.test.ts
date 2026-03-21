import { isDir } from '../../src/util/is-dir.js';
import {
	createTempDir,
	createTempName,
	createTempPath,
	createTempDirSync,
} from '../../src/util/temp.js';
import { rm } from 'node:fs/promises';
import { basename, isAbsolute } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('createTempName', () => {
	it('should create a temporary directory name', () => {
		expect(createTempName()).toMatch(/^[0-9a-f]{32}$/);
	});

	it('should create a temporary directory name with a name', () => {
		expect(createTempName({ name: 'test' })).toBe('test');
	});

	it('should create a temporary directory name with a prefix', () => {
		expect(createTempName({ prefix: 'prefix' })).toMatch(/^prefix-[0-9a-f]{32}$/);
	});

	it('should create a temporary directory name with a suffix', () => {
		expect(createTempName({ suffix: 'suffix' })).toMatch(/^[0-9a-f]{32}-suffix$/);
	});

	it('should create a temporary directory name with a prefix and suffix', () => {
		expect(createTempName({ prefix: 'prefix', suffix: 'suffix' })).toMatch(
			/^prefix-[0-9a-f]{32}-suffix$/
		);
	});

	it('should create a temporary directory name with a name, prefix, and suffix', () => {
		expect(createTempName({ name: 'test', prefix: 'prefix', suffix: 'suffix' })).toBe(
			'prefix-test-suffix'
		);
	});
});

describe('createTempPath', () => {
	it('should create a temporary directory path', () => {
		const path = createTempPath();
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toMatch(/^[0-9a-f]{32}$/);
	});

	it('should create a temporary directory path with a name', () => {
		const path = createTempPath({ name: 'test' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toBe('test');
	});

	it('should create a temporary directory path with a prefix', () => {
		const path = createTempPath({ prefix: 'prefix' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toMatch(/^prefix-[0-9a-f]{32}$/);
	});

	it('should create a temporary directory path with a name and prefix', () => {
		const path = createTempPath({ name: 'test', prefix: 'prefix' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toBe('prefix-test');
	});

	it('should create a temporary directory path with a suffix', () => {
		const path = createTempPath({ suffix: 'suffix' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toMatch(/^[0-9a-f]{32}-suffix$/);
	});

	it('should create a temporary directory path with a name and suffix', () => {
		const path = createTempPath({ name: 'test', suffix: 'suffix' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toBe('test-suffix');
	});

	it('should create a temporary directory path with a prefix and suffix', () => {
		const path = createTempPath({ prefix: 'prefix', suffix: 'suffix' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toMatch(/^prefix-[0-9a-f]{32}-suffix$/);
	});

	it('should create a temporary directory path with a name, prefix, and suffix', () => {
		const path = createTempPath({ name: 'test', prefix: 'prefix', suffix: 'suffix' });
		expect(isAbsolute(path)).toBe(true);
		expect(basename(path)).toBe('prefix-test-suffix');
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

	it('should create a temporary directory with a name', async () => {
		tmpDir = await createTempDir({ name: 'test' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toBe('test');
	});

	it('should create a temporary directory with a prefix', async () => {
		tmpDir = await createTempDir({ prefix: 'prefix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^prefix-[0-9a-f]{32}$/);
	});

	it('should create a temporary directory with a name and prefix', async () => {
		tmpDir = await createTempDir({ name: 'test', prefix: 'prefix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toBe('prefix-test');
	});

	it('should create a temporary directory with a suffix', async () => {
		tmpDir = await createTempDir({ suffix: 'suffix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^[0-9a-f]{32}-suffix$/);
	});

	it('should create a temporary directory with a name and suffix', async () => {
		tmpDir = await createTempDir({ name: 'test', suffix: 'suffix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toBe('test-suffix');
	});

	it('should create a temporary directory with a name and prefix and suffix', async () => {
		tmpDir = await createTempDir({ name: 'test', prefix: 'prefix', suffix: 'suffix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toBe('prefix-test-suffix');
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

	it('should create a temporary directory with a name synchronously', () => {
		tmpDir = createTempDirSync({ name: 'test' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toBe('test');
	});

	it('should create a temporary directory with a prefix synchronously', () => {
		tmpDir = createTempDirSync({ prefix: 'prefix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^prefix-[0-9a-f]{32}$/);
	});

	it('should create a temporary directory with a name and prefix synchronously', () => {
		tmpDir = createTempDirSync({ name: 'test', prefix: 'prefix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toBe('prefix-test');
	});

	it('should create a temporary directory with a suffix synchronously', () => {
		tmpDir = createTempDirSync({ suffix: 'suffix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^[0-9a-f]{32}-suffix$/);
	});

	it('should create a temporary directory with a name and suffix synchronously', () => {
		tmpDir = createTempDirSync({ name: 'test', suffix: 'suffix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toBe('test-suffix');
	});

	it('should create a temporary directory with a prefix and suffix synchronously', () => {
		tmpDir = createTempDirSync({ prefix: 'prefix', suffix: 'suffix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toMatch(/^prefix-[0-9a-f]{32}-suffix$/);
	});

	it('should create a temporary directory with a name, prefix, and suffix synchronously', () => {
		tmpDir = createTempDirSync({ name: 'test', prefix: 'prefix', suffix: 'suffix' });
		expect(isDir(tmpDir)).toBe(true);
		expect(basename(tmpDir)).toBe('prefix-test-suffix');
	});
});
