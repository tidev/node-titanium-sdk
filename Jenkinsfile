timestamps {
  node() {
    stage('Checkout') {
      checkout scm
    }

    stage('Build') {
      nodejs(nodeJSInstallationName: 'node 6.9.5') {
        sh 'npm install -g yarn'
        sh 'yarn install'
        sh 'npm test'
      }
      fingerprint 'package.json'
      junit 'junit_report.xml'
    }
  }
}
