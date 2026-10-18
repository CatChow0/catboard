// CatBoard pipeline: every commit is checked (types, unit, API and browser
// tests) before an image is built; only `main` builds and pushes the image.
// Agent needs: Docker, and Node 24 from the NodeJS plugin
// (Manage Jenkins > Tools > NodeJS installations, name "node-24").
pipeline {
  agent { label 'docker' }

  tools { nodejs 'node-24' }

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    IMAGE = 'catchow/catboard'
    CI = 'true'
  }

  stages {
    stage('Infos') {
      steps {
        script {
          env.SHA     = env.GIT_COMMIT.take(7)
          env.VERSION = sh(
            script: '''sed -n 's/.*"version": *"\\([^"]*\\)".*/\\1/p' package.json | head -1''',
            returnStdout: true
          ).trim()
          // Multibranch jobs set BRANCH_NAME, plain pipeline jobs GIT_BRANCH (origin/main).
          env.IS_MAIN = ((env.BRANCH_NAME ?: env.GIT_BRANCH ?: '') ==~ /(origin\/)?main/).toString()
          currentBuild.displayName = "#${env.BUILD_NUMBER} v${env.VERSION} (${env.SHA})"
        }
        echo "Image : ${IMAGE} | version : ${VERSION} | commit : ${SHA} | publish : ${IS_MAIN}"
        sh 'node --version && npm --version'
      }
    }

    stage('Install') {
      steps {
        sh 'npm ci --no-audit --no-fund'
      }
    }

    stage('Types') {
      steps {
        sh 'npm run check'
      }
    }

    stage('Unit tests') {
      steps {
        sh 'npm test'
      }
    }

    stage('App build') {
      steps {
        sh 'npm run build'
      }
    }

    stage('API tests') {
      steps {
        sh 'npm run test:api'
      }
    }

    stage('E2E tests') {
      // Chromium and its system libraries are installed in a throw-away node
      // container (root there, nothing installed on the agent); the browser
      // download is cached in a Docker volume. The workspace (node_modules,
      // build) is shared with the agent.
      agent {
        docker {
          image 'node:24-bookworm'
          args '-u root --ipc=host -v catboard-playwright:/root/.cache/ms-playwright'
          reuseNode true
        }
      }
      steps {
        sh 'npx playwright install --with-deps chromium'
        sh 'npm run test:e2e'
      }
      post {
        always {
          // Files written as root in the container go back to the agent's user.
          sh 'chown -R "$(stat -c %u:%g Jenkinsfile)" reports test-results playwright-report 2>/dev/null || true'
        }
      }
    }

    stage('Image') {
      when { environment name: 'IS_MAIN', value: 'true' }
      steps {
        sh 'docker build --pull -t $IMAGE:$VERSION -t $IMAGE:$SHA -t $IMAGE:latest .'
      }
    }

    stage('Push') {
      when { environment name: 'IS_MAIN', value: 'true' }
      steps {
        withCredentials([usernamePassword(credentialsId: 'registry-creds',
                         usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh 'echo "$REG_PASS" | docker login -u "$REG_USER" --password-stdin'
          sh 'docker push $IMAGE:$VERSION'
          sh 'docker push $IMAGE:$SHA'
          sh 'docker push $IMAGE:latest'
        }
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'reports/*.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'playwright-report/**, test-results/**'
      sh 'docker logout || true'
      sh 'docker image prune -f || true'
    }
  }
}
