#! groovy
library 'pipeline-library'

timestamps {
	node('(osx || linux) && npm-publish') {
		def packageVersion = ''
		def isPR = false

		timeout(10) {
			stage('Checkout') {
				// checkout scm
				// Hack for JENKINS-37658 - see https://support.cloudbees.com/hc/en-us/articles/226122247-How-to-Customize-Checkout-for-Pipeline-Multibranch
				checkout([
					$class: 'GitSCM',
					branches: scm.branches,
					extensions: scm.extensions + [[$class: 'CleanBeforeCheckout'], [$class: 'CloneOption', honorRefspec: true, noTags: true, reference: '', shallow: true, depth: 30, timeout: 30]],
					userRemoteConfigs: scm.userRemoteConfigs
				])

				isPR = env.BRANCH_NAME.startsWith('PR-')
				packageVersion = jsonParse(readFile('package.json'))['version']
				currentBuild.displayName = "#${packageVersion}-${currentBuild.number}"
			}

			nodejs(nodeJSInstallationName: 'node 6.9.5') {
				stage('Build') {
					ansiColor('xterm') {
						// Install yarn if not installed
						if (sh(returnStatus: true, script: 'which yarn') != 0) {
							// TODO Install using the curl script via chef before-hand?
							// sh 'curl -o- -L https://yarnpkg.com/install.sh | bash'
							sh 'npm install -g yarn'
						}
						sh 'yarn install'
						try {
							sh 'yarn test'
						} finally {
							junit 'junit_report.xml'
						}
					} // ansiColor
					fingerprint 'package.json'
					// Don't tag PRs
					if (!isPR) {
						pushGitTag(name: packageVersion, message: "See ${env.BUILD_URL} for more information.", force: true)
					}
				} // stage

				stage('Publish') {
					if (!isPR) {
						sh 'npm publish'
					}
				} // stage
			} // nodejs
		} // timeout
	} // node
} // timestamps
