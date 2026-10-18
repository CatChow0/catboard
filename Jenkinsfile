pipeline {
  agent { label 'docker' }

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    IMAGE = 'catchow/catboard'
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
          currentBuild.displayName = "#${env.BUILD_NUMBER} v${env.VERSION} (${env.SHA})"
        }
        echo "Image : ${IMAGE} | version : ${VERSION} | commit : ${SHA}"
      }
    }

    stage('Build') {
      steps {
        sh 'docker build --pull -t $IMAGE:$VERSION -t $IMAGE:$SHA -t $IMAGE:latest .'
      }
    }

    stage('Push') {
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
      sh 'docker logout || true'
      sh 'docker image prune -f || true'
    }
  }
}