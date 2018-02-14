'use strict';

const spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
	tests = [
		'jsanalyze_test.js',
		'tiappxml_test.js'
	];

let exitCode = 0;

(function next() {
	if (tests.length === 0) {
		process.exit(exitCode);
	}

	var file = tests.shift();
	console.log(file);

	var proc = spawn('node', [ 'tests/' + file ]);
	proc.stdout.pipe(process.stdout);
	proc.stderr.pipe(process.stderr);
	proc.on('exit', function (code) {
		exitCode += code || 0;
		console.log('');
		next();
	});
}());
