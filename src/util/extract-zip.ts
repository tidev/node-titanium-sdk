import { expand } from './expand';
import { isFile } from './is-file';
import fs, { existsSync } from 'node:fs';
import { mkdir, symlink, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import yauzl from 'yauzl';

type ExtractZipOptions = {
	defaultPerm?: number;
	onEntry?: (
		entry: yauzl.Entry,
		index: number,
		total: number
	) => void | Promise<void> | boolean | Promise<boolean>;
	overwrite?: boolean;
};

export async function extractZip(zipFile: string, dest: string, opts?: ExtractZipOptions) {
	if (!zipFile || typeof zipFile !== 'string') {
		throw new TypeError('Expected zip file to be a non-empty string');
	}

	if (!existsSync(zipFile)) {
		throw new Error('The specified zip file does not exist');
	}

	if (!isFile(zipFile)) {
		throw new Error('The specified zip file is not a file');
	}

	if (!dest || typeof dest !== 'string') {
		throw new TypeError('Expected destination directory to be a non-empty string');
	}

	await new Promise((resolve, reject) => {
		yauzl.open(zipFile, { lazyEntries: true }, (err, zipfile) => {
			if (err) {
				return reject(new Error(`Invalid zip file: ${err.message || err}`));
			}

			let idx = -1;
			const total = zipfile.entryCount;
			const overwrite = opts?.overwrite !== false;
			const abort = (err) => {
				zipfile.removeListener('end', resolve);
				zipfile.close();
				reject(err);
			};

			zipfile
				.on('entry', async (entry) => {
					idx++;

					const destFile = expand(dest, entry.fileName);

					if (entry.fileName.startsWith('__MACOSX/') || (!overwrite && isFile(destFile))) {
						zipfile.readEntry();
						return;
					}

					if (typeof opts?.onEntry === 'function') {
						try {
							if ((await opts.onEntry(entry, idx, total)) === false) {
								zipfile.readEntry();
								return;
							}
						} catch (err) {
							return abort(err);
						}
					}

					const mode = (entry.externalFileAttributes >>> 16) & 0xffff || 0o644;
					const isSymlink = (mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK;
					let isDir = (mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR;
					const madeBy = entry.versionMadeBy >> 8;
					if (!isDir) {
						isDir = madeBy === 0 && entry.externalFileAttributes === 16;
					}

					if (isSymlink) {
						await mkdir(dirname(destFile), { recursive: true });
						console.log('FOUND SYMLINK!', {
							destFile,
							entry,
						});
						zipfile.openReadStream(entry, (err, readStream) => {
							if (err) {
								return abort(err);
							}

							const chunks: Buffer[] = [];
							readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
							readStream.on('error', abort);
							readStream.on('end', async () => {
								const str = Buffer.concat(chunks).toString('utf8');
								console.log('SYMLINK CONTENT:', str);
								console.log('DEST FILE:', destFile);
								console.log('EXISTS:', existsSync(destFile));
								if (existsSync(destFile)) {
									await unlink(destFile);
								}
								try {
									await symlink(str, destFile);
								} catch (err) {
									console.error('ERROR SYMLINKING:', err);
									return abort(new Error(`Error symlinking ${destFile}: ${(err as Error).message || err}`));
								}
								zipfile.readEntry();
							});
						});
					} else if (isDir) {
						await mkdir(destFile, { recursive: true });
						zipfile.readEntry();
					} else {
						await mkdir(dirname(destFile), { recursive: true });
						zipfile.openReadStream(entry, (err, readStream) => {
							if (err) {
								return abort(err);
							}

							const writeStream = fs.createWriteStream(destFile, { mode });
							writeStream.on('close', () => zipfile.readEntry());
							writeStream.on('error', abort);
							readStream.pipe(writeStream);
						});
					}
				})
				.on('end', resolve)
				.on('error', reject)
				.readEntry();
		});
	});
}
