#!/bin/bash

# Legal AI Assistant Deployment Script
# This script deploys the application to Google Cloud Run

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-""}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}
ENVIRONMENT=${ENVIRONMENT:-"production"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if [ -z "$PROJECT_ID" ]; then
        log_error "GOOGLE_CLOUD_PROJECT_ID environment variable is not set"
        exit 1
    fi
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if authenticated with gcloud
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "Not authenticated with gcloud. Run 'gcloud auth login'"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Set up Google Cloud project
setup_gcloud() {
    log_info "Setting up Google Cloud project..."
    
    gcloud config set project $PROJECT_ID
    gcloud config set run/region $REGION
    
    # Enable required APIs
    log_info "Enabling required APIs..."
    gcloud services enable \
        cloudbuild.googleapis.com \
        run.googleapis.com \
        containerregistry.googleapis.com \
        artifactregistry.googleapis.com \
        secretmanager.googleapis.com \
        sql-component.googleapis.com \
        redis.googleapis.com \
        aiplatform.googleapis.com \
        documentai.googleapis.com \
        storage-component.googleapis.com \
        firestore.googleapis.com
}

# Create service accounts
create_service_accounts() {
    log_info "Creating service accounts..."
    
    # Backend service account
    gcloud iam service-accounts create legal-ai-backend-sa \
        --display-name="Legal AI Backend Service Account" \
        --description="Service account for Legal AI backend service" || true
    
    # Frontend service account
    gcloud iam service-accounts create legal-ai-frontend-sa \
        --display-name="Legal AI Frontend Service Account" \
        --description="Service account for Legal AI frontend service" || true
    
    # Grant necessary permissions
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:legal-ai-backend-sa@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="roles/aiplatform.user"
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:legal-ai-backend-sa@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="roles/documentai.apiUser"
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:legal-ai-backend-sa@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="roles/storage.objectAdmin"
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:legal-ai-backend-sa@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="roles/datastore.user"
}

# Create secrets
create_secrets() {
    log_info "Creating secrets..."
    
    # Database URL secret
    if [ ! -z "$DATABASE_URL" ]; then
        echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=- || \
        echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-
    fi
    
    # JWT secret
    if [ ! -z "$JWT_SECRET" ]; then
        echo -n "$JWT_SECRET" | gcloud secrets create jwt-config --data-file=- || \
        echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-config --data-file=-
    fi
    
    # Google Cloud project ID
    echo -n "$PROJECT_ID" | gcloud secrets create google-cloud-config --data-file=- || \
    echo -n "$PROJECT_ID" | gcloud secrets versions add google-cloud-config --data-file=-
    
    # Redis URL (if using external Redis)
    if [ ! -z "$REDIS_URL" ]; then
        echo -n "$REDIS_URL" | gcloud secrets create redis-config --data-file=- || \
        echo -n "$REDIS_URL" | gcloud secrets versions add redis-config --data-file=-
    fi
}

# Build and push Docker images
build_and_push() {
    log_info "Building and pushing Docker images..."
    
    # Get build ID
    BUILD_ID=$(date +%Y%m%d-%H%M%S)
    
    # Build frontend
    log_info "Building frontend image..."
    docker build -t gcr.io/$PROJECT_ID/legal-ai-frontend:$BUILD_ID \
                 -t gcr.io/$PROJECT_ID/legal-ai-frontend:latest \
                 -f apps/frontend/Dockerfile.prod .
    
    # Build backend
    log_info "Building backend image..."
    docker build -t gcr.io/$PROJECT_ID/legal-ai-backend:$BUILD_ID \
                 -t gcr.io/$PROJECT_ID/legal-ai-backend:latest \
                 -f apps/backend/Dockerfile.prod .
    
    # Push images
    log_info "Pushing images to Container Registry..."
    docker push gcr.io/$PROJECT_ID/legal-ai-frontend:$BUILD_ID
    docker push gcr.io/$PROJECT_ID/legal-ai-frontend:latest
    docker push gcr.io/$PROJECT_ID/legal-ai-backend:$BUILD_ID
    docker push gcr.io/$PROJECT_ID/legal-ai-backend:latest
    
    echo $BUILD_ID > .build-id
}

# Deploy to Cloud Run
deploy_services() {
    log_info "Deploying services to Cloud Run..."
    
    BUILD_ID=$(cat .build-id)
    
    # Deploy backend
    log_info "Deploying backend service..."
    gcloud run deploy legal-ai-backend \
        --image gcr.io/$PROJECT_ID/legal-ai-backend:$BUILD_ID \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --service-account legal-ai-backend-sa@$PROJECT_ID.iam.gserviceaccount.com \
        --set-env-vars NODE_ENV=production \
        --set-secrets DATABASE_URL=database-url:latest \
        --set-secrets GOOGLE_CLOUD_PROJECT_ID=google-cloud-config:latest \
        --set-secrets JWT_SECRET=jwt-config:latest \
        --memory 2Gi \
        --cpu 2 \
        --max-instances 100 \
        --min-instances 1 \
        --concurrency 80 \
        --timeout 300s \
        --port 3001
    
    # Get backend URL
    BACKEND_URL=$(gcloud run services describe legal-ai-backend --region=$REGION --format='value(status.url)')
    
    # Deploy frontend
    log_info "Deploying frontend service..."
    gcloud run deploy legal-ai-frontend \
        --image gcr.io/$PROJECT_ID/legal-ai-frontend:$BUILD_ID \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --service-account legal-ai-frontend-sa@$PROJECT_ID.iam.gserviceaccount.com \
        --set-env-vars NODE_ENV=production,NEXT_PUBLIC_API_URL=$BACKEND_URL,NEXT_TELEMETRY_DISABLED=1 \
        --memory 1Gi \
        --cpu 1 \
        --max-instances 50 \
        --min-instances 0 \
        --concurrency 100 \
        --timeout 60s \
        --port 3000
    
    # Get frontend URL
    FRONTEND_URL=$(gcloud run services describe legal-ai-frontend --region=$REGION --format='value(status.url)')
    
    log_info "Deployment completed successfully!"
    log_info "Frontend URL: $FRONTEND_URL"
    log_info "Backend URL: $BACKEND_URL"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Create a Cloud Run job for migrations
    gcloud run jobs create legal-ai-migrations \
        --image gcr.io/$PROJECT_ID/legal-ai-backend:latest \
        --region $REGION \
        --service-account legal-ai-backend-sa@$PROJECT_ID.iam.gserviceaccount.com \
        --set-env-vars NODE_ENV=production \
        --set-secrets DATABASE_URL=database-url:latest \
        --memory 1Gi \
        --cpu 1 \
        --max-retries 3 \
        --parallelism 1 \
        --task-count 1 \
        --task-timeout 600s \
        --command npm \
        --args run,migrate || true
    
    # Execute the migration job
    gcloud run jobs execute legal-ai-migrations --region $REGION --wait
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    FRONTEND_URL=$(gcloud run services describe legal-ai-frontend --region=$REGION --format='value(status.url)')
    BACKEND_URL=$(gcloud run services describe legal-ai-backend --region=$REGION --format='value(status.url)')
    
    # Check backend health
    if curl -f "$BACKEND_URL/health" > /dev/null 2>&1; then
        log_info "Backend health check passed"
    else
        log_error "Backend health check failed"
        exit 1
    fi
    
    # Check frontend health
    if curl -f "$FRONTEND_URL/api/health" > /dev/null 2>&1; then
        log_info "Frontend health check passed"
    else
        log_warn "Frontend health check failed (may take a few minutes to start)"
    fi
    
    log_info "Deployment verification completed"
}

# Main deployment function
main() {
    log_info "Starting deployment of Legal AI Assistant to Google Cloud Run..."
    
    check_prerequisites
    setup_gcloud
    create_service_accounts
    create_secrets
    build_and_push
    deploy_services
    run_migrations
    verify_deployment
    
    log_info "Deployment completed successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        check_prerequisites
        build_and_push
        ;;
    "setup")
        check_prerequisites
        setup_gcloud
        create_service_accounts
        create_secrets
        ;;
    "verify")
        verify_deployment
        ;;
    *)
        echo "Usage: $0 [deploy|build|setup|verify]"
        echo "  deploy: Full deployment (default)"
        echo "  build:  Build and push images only"
        echo "  setup:  Setup Google Cloud resources only"
        echo "  verify: Verify existing deployment"
        exit 1
        ;;
esac