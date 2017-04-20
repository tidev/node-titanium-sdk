#! groovy
timestamps {
  node('(osx || linux) && curl') {
    timeout(5) {
      stage('Checkout') {
        checkout scm
      }

      stage('Build') {
        nodejs(nodeJSInstallationName: 'node 6.9.5') {
          ansiColor('xterm') {
            // Install yarn if not installed
            if (sh(returnStatus: true, script: 'which yarn') != 0) {
              sh 'curl -o- -L https://yarnpkg.com/install.sh | bash'
            }
            sh 'yarn install'
            sh 'npm test'
          } // ansiColor
        } // nodejs
        fingerprint 'package.json'
        junit 'junit_report.xml'
      } // stage
    } // timeout
  } // node
} // timestamps
