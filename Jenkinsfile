// InclusiVenue — pipeline CI/CD Jenkins
// Étapes : checkout -> (backend || frontend) -> build images Docker -> push (option) -> déploiement -> smoke test
// Prérequis : voir deliverables/JENKINS.md (Jenkins avec Node 22 + Docker CLI + socket Docker).
pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 45, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
    disableConcurrentBuilds()
  }

  // Sans URL publique (Jenkins local), GitHub ne peut pas appeler un webhook : on interroge le dépôt toutes les ~5 min.
  triggers { pollSCM('H/5 * * * *') }

  parameters {
    booleanParam(name: 'PUSH_IMAGES', defaultValue: false, description: 'Pousser les images sur Docker Hub (credential "dockerhub-creds")')
    booleanParam(name: 'DEPLOY', defaultValue: true, description: 'Déployer la stack avec docker compose (credential "inclusivenue-jwt")')
  }

  environment {
    CI = 'true'
    COMPOSE_PROJECT_NAME = 'inclusivenue'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'node -v && npm -v && docker --version && docker compose version'
      }
    }

    stage('Build & tests') {
      parallel {

        stage('Backend') {
          stages {
            stage('Backend - install + lint') {
              steps {
                dir('backend') {
                  sh 'if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi'
                  sh 'npm run lint'
                }
              }
            }
            stage('Backend - tests unitaires') {
              steps {
                dir('backend') {
                  sh 'mkdir -p reports'
                  sh 'node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=reports/unit.xml "tests/unit/**/*.test.js"'
                }
              }
              post { always { junit allowEmptyResults: true, testResults: 'backend/reports/unit.xml' } }
            }
            stage('Backend - tests d\'intégration') {
              steps {
                // mongodb-memory-server télécharge mongod au 1er lancement (accès Internet requis).
                // UNSTABLE au lieu de FAILURE tant que ces tests n'ont pas été validés sur Jenkins ; retirer catchError ensuite.
                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                  dir('backend') {
                    sh 'node --test --test-concurrency=1 --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=reports/integration.xml "tests/integration/**/*.test.js"'
                  }
                }
              }
              post { always { junit allowEmptyResults: true, testResults: 'backend/reports/integration.xml' } }
            }
          }
        }

        stage('Frontend') {
          stages {
            stage('Frontend - install') {
              steps {
                dir('frontend') {
                  sh 'if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi'
                }
              }
            }
            stage('Frontend - lint') {
              steps {
                dir('frontend') { sh 'npm run lint' }
              }
            }
            stage('Frontend - tests + build') {
              steps {
                dir('frontend') {
                  sh 'npm test'
                  sh 'npm run build'
                }
              }
              post { success { archiveArtifacts artifacts: 'frontend/dist/**', fingerprint: true } }
            }
          }
        }

      }
    }

    stage('Docker build') {
      steps {
        sh '''
          docker build -t inclusivenue-backend:${IMAGE_TAG}  -t inclusivenue-backend:latest  ./backend
          docker build -t inclusivenue-frontend:${IMAGE_TAG} -t inclusivenue-frontend:latest ./frontend
        '''
      }
    }

    stage('Push Docker Hub') {
      when { expression { return params.PUSH_IMAGES } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            for svc in backend frontend; do
              docker tag inclusivenue-$svc:${IMAGE_TAG} $DH_USER/inclusivenue-$svc:${IMAGE_TAG}
              docker tag inclusivenue-$svc:latest       $DH_USER/inclusivenue-$svc:latest
              docker push $DH_USER/inclusivenue-$svc:${IMAGE_TAG}
              docker push $DH_USER/inclusivenue-$svc:latest
            done
            docker logout
          '''
        }
      }
    }

    stage('Deploy (docker compose)') {
      when { expression { return params.DEPLOY } }
      steps {
        withCredentials([string(credentialsId: 'inclusivenue-jwt', variable: 'JWT_SECRET')]) {
          sh '''
            docker compose config -q
            docker compose up -d --build --wait --wait-timeout 180
            docker compose ps
          '''
        }
      }
    }

    stage('Smoke test') {
      when { expression { return params.DEPLOY } }
      steps {
        // Les tests passent par "docker compose exec" : depuis le conteneur Jenkins, "localhost" n'est pas l'hôte Docker.
        sh '''
          docker compose exec -T api node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>r.json()).then(j=>{console.log(JSON.stringify(j));process.exit(j.status==='ok'?0:1)}).catch(()=>process.exit(1))"
          docker compose exec -T web wget -qO- http://127.0.0.1/healthz
          echo
          docker compose exec -T web wget -qO- "http://127.0.0.1/api/events?limit=1" | head -c 300
          echo
        '''
      }
    }
  }

  post {
    failure {
      sh 'docker compose logs --no-color --tail=200 || true'
    }
    always {
      sh 'docker image prune -f || true'
    }
    success { echo "Build #${env.BUILD_NUMBER} OK — application sur http://localhost:8080 (hôte Docker)" }
    unstable { echo 'Build UNSTABLE : voir les stages en jaune (tests d\'intégration).' }
  }
}