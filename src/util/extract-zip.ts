import { exists } from './exists.js';
import { expand } from './expand.js';
import { isFile } from './is-file.js';
import fs from 'node:fs';
import { mkdir, rm, symlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import snooplogg from 'snooplogg';
import yauzl from 'yauzl';

const { error, log } = snooplogg('extract-zip');

type ExtractZipOptions = {
	defaultPerm?: number;
	onEntry?: (
		entry: yauzl.Entry,
		index: number,
		total: number
	) => void | Promise<void> | boolean | Promise<boolean>;
};

export async function extractZip(zipFile: string, dest: string, opts?: ExtractZipOptions) {
	if (!zipFile || typeof zipFile !== 'string') {
		throw new TypeError('Expected zip file to be a non-empty string');
	}

	if (!(await exists(zipFile))) {
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
			const abort = (err) => {
				zipfile.removeListener('end', resolve);
				zipfile.close();
				error(err);
				reject(err);
			};

			log(`Extracting: "${zipFile}" to "${dest}"`);

			zipfile
				.on('entry', async (entry) => {
					try {
						idx++;

						if (typeof opts?.onEntry === 'function') {
							if ((await opts.onEntry(entry, idx, total)) === false) {
								log(`Skipping: "${entry.fileName}" (onEntry callback returned false)`);
								zipfile.readEntry();
								return;
							}
						}

						const destFile = expand(dest, entry.fileName);
						const mode = (entry.externalFileAttributes >>> 16) & 0xffff || 0o644;
						const isSymlink = (mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK;
						let isDir = (mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR;
						const madeBy = entry.versionMadeBy >> 8;
						if (!isDir) {
							isDir = madeBy === 0 && entry.externalFileAttributes === 16;
						}

						if (isSymlink) {
							if (!(await exists(dirname(destFile)))) {
								log(`Creating directory: ${dirname(destFile)}`);
								await mkdir(dirname(destFile), { recursive: true });
							}

							zipfile.openReadStream(entry, (err, readStream) => {
								if (err) {
									return abort(err);
								}

								const chunks: Buffer[] = [];
								const cleanupAndAbort = (err) => {
									readStream.removeAllListeners();
									readStream.destroy();
									abort(err);
								};

								readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
								readStream.on('error', cleanupAndAbort);
								readStream.on('end', async () => {
									const target = Buffer.concat(chunks)
										.toString('utf8')
										.replace(/[\\/]$/, '');

									try {
										log(`Symlinking: ${destFile} => ${target}`);
										let destExists = await exists(destFile);
										if (destExists) {
											log(`Deleting existing symlink dest: ${destFile}`);
											await rm(destFile, { force: true, recursive: true });
										}
										await symlink(target, destFile);
										zipfile.readEntry();
									} catch (err) {
										cleanupAndAbort(
											new Error(`Error symlinking ${destFile}: ${(err as Error).message || err}`)
										);
									}
								});
							});
						} else if (isDir) {
							if (!(await exists(dirname(destFile)))) {
								log(`Creating directory: ${dirname(destFile)}`);
								await mkdir(dirname(destFile), { recursive: true });
							}
							zipfile.readEntry();
						} else {
							const dir = dirname(destFile);
							if (!(await exists(dir))) {
								log(`Creating directory: ${dir}`);
								await mkdir(dir, { recursive: true });
							}

							zipfile.openReadStream(entry, (err, readStream) => {
								if (err) {
									return abort(err);
								}

								log(`Extracting file: ${entry.fileName}`);
								const writeStream = fs.createWriteStream(destFile, { mode });
								const cleanupAndAbort = (err) => {
									readStream.removeAllListeners();
									readStream.unpipe();
									readStream.destroy();
									writeStream.removeAllListeners();
									writeStream.destroy();
									abort(err);
								};

								writeStream.on('close', () => zipfile.readEntry());
								writeStream.on('error', cleanupAndAbort);
								readStream.on('error', cleanupAndAbort);
								readStream.pipe(writeStream);
							});
						}
					} catch (err) {
						return abort(err);
					}
				})
				.on('end', resolve)
				.on('error', reject)
				.readEntry();
		});
	});
}
