'use strict';

module.exports = function (grunt) {

	// Project configuration.
	grunt.initConfig({
		appcJs: {
			src: [
				'Gruntfile.js',
				'lib/**/*.js',
				'tests/**/*.js'
			]
		},
		mocha_istanbul: {
			options: {
				timeout: 30000,
				reporter: 'mocha-jenkins-reporter',
				ignoreLeaks: false,
				reportFormats: [ 'cobertura' ],
				check: {
					statements: 59,
					branches: 50,
					functions: 62,
					lines: 59
				}
			},
			src: [ 'tests/*_test.js' ]
		}
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-mocha-istanbul');
	grunt.loadNpmTasks('grunt-appc-js');

	// register tasks
	grunt.registerTask('lint', [ 'appcJs' ]);
	grunt.registerTask('test', [ 'mocha_istanbul' ]);

	// Tasks for formatting the source code according to our clang/eslint rules
	grunt.registerTask('format:js', [ 'appcJs:src:lint:fix' ]);
	grunt.registerTask('format', [ 'format:js' ]);

	grunt.registerTask('default', [ 'lint', 'test' ]);
};
