import fs from 'node:fs';
import yauzl from 'yauzl';
import path from 'node:path';

const IFMT = 61440;
const IFDIR = 16384;
const IFLNK = 40960;

/**
 * Extracts all files and applies the correct file permissions.
 * @param {String} file - The file to extract
 * @param {String} dest - The destination to extract the files to
 * @param {Object} opts - Extract options
 * @param {Function} [opts.visitor] - A function to call when visiting each file being extracted
 * @param {Boolean} [opts.overwrite=true] - If true, overwrites files on extraction
 * @param {Number} [opts.defaultPerm=0o644] - The default file permissions; should be in octet format
 */
export async function unzip(file, dest, opts) {
	const visitor = opts?.visitor || (() => {});
	const overwrite = opts && Object.hasOwn(opts, 'overwrite') ? !!opts.overwrite : true;
	const defaultPerm = opts?.defaultPerm || 0o644;

	return new Promise((resolve, reject) => {
		yauzl.open(file, { lazyEntries: true }, (err, zipfile) => {
			if (err) {
				return reject(err);
			}
			let i = 0;
			const len = zipfile.entryCount;
			zipfile.once('error', err => reject(err));
			zipfile.on('close', () => resolve());
			zipfile.on('entry', (entry) => {
				if (entry.fileName.startsWith('__MACOSX/')) {
					zipfile.readEntry();
					return;
				}

				// handle visitor function!
				if (visitor(entry, i, len) === false) {
					zipfile.readEntry();
					return;
				}

				const destFile = expand(dest, entry.fileName);

				// convert external file attr int into a fs stat mode int
				let mode = (entry.externalFileAttributes >> 16) & 0xFFFF;
				// check if it's a symlink or dir (using stat mode constants)
				const symlink = (mode & IFMT) === IFLNK;
				let isDir = (mode & IFMT) === IFDIR;
				// check for windows weird way of specifying a directory
				// https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
				const madeBy = entry.versionMadeBy >> 8;
				if (!isDir) {
					isDir = (madeBy === 0 && entry.externalFileAttributes === 16);
				}

				// if no mode then default to default modes
				if (mode === 0) {
					mode = defaultPerm;
				}

				// If we're not overwriting and destiantion exists, move on to next entry
				if (!overwrite && fs.existsSync(destFile)) {
					zipfile.readEntry();
					return;
				}

				if (symlink) {
					// How do we handle a symlink?
					zipfile.openReadStream(entry, (err, readStream) => {
						if (err) {
							return reject(err);
						}
						fs.mkdirSync(path.dirname(destFile), { recursive: true });
						const chunks = [];
						readStream.on('data', chunk => chunks.push(chunk));
						readStream.on('error', err => reject(err));
						readStream.on('end', () => {
							let str = Buffer.concat(chunks).toString('utf8');
							if (fs.existsSync(destFile)) {
								fs.unlinkSync(destFile);
							}
							fs.symlinkSync(str, destFile);
							zipfile.readEntry();
						});
					});
				} else if (isDir) {
					fs.mkdirSync(destFile, { mode, recursive: true });
					i++;
					zipfile.readEntry();
				} else {
					// file entry
					zipfile.openReadStream(entry, (err, readStream) => {
						if (err) {
							return reject(err);
						}
						fs.mkdirSync(path.dirname(destFile), { recursive: true });

						// pump file contents
						readStream.on('end', () => zipfile.readEntry());
						readStream.once('error', err => reject(err));
						const writeStream = fs.createWriteStream(destFile, { mode });
						readStream.pipe(writeStream);
						i++;
					});
				}
			});
			zipfile.readEntry();
		});
	});
}
