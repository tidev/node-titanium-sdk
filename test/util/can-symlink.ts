import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function canSymlink(): boolean {
	const tmpDir = join(
		tmpdir(),
		'node-titanium-sdk',
		`symlink-test-${randomBytes(8).toString('hex')}`
	);
	mkdirSync(tmpDir, { recursive: true });
	try {
		writeFileSync(join(tmpDir, 'test.txt'), 'test');
		symlinkSync(join(tmpDir, 'test.txt'), join(tmpDir, 'link.txt'));
		symlinkSync(join(tmpDir, 'does_not_exist.txt'), join(tmpDir, 'link2.txt'));
		return true;
	} catch {
		return false;
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
}
