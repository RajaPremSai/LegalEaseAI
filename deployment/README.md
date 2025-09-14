# Legal AI Assistant - Production Deployment Guide

This guide covers the deployment of the Legal AI Assistant to Google Cloud Run with CI/CD, auto-scaling, and monitoring.

## Prerequisites

### Required Tools
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- [Docker](https://docs.docker.com/get-docker/)
- [Node.js 18+](https://nodejs.org/)
- [Git](https://git-scm.com/)

### Google Cloud Setup
1. Create a Google Cloud Project
2. Enable billing for the project
3. Install and authenticate gcloud CLI:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

## Quick Deployment

### 1. Environment Setup
```bash
# Clone the repository
git clone <repository-url>
cd legal-document-ai-assistant

# Set environment variables
export GOOGLE_CLOUD_PROJECT_ID="your-project-id"
export GOOGLE_CLOUD_REGION="us-central1"
export DATABASE_URL="postgresql://user:pass@host:port/db"
export JWT_SECRET="your-jwt-secret"
```

### 2. Deploy to Production
```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Run full deployment
./scripts/deploy.sh deploy
```

### 3. Verify Deployment
```bash
# Run verification tests
node scripts/verify-deployment.js
```

## Detailed Deployment Steps

### 1. Infrastructure Setup

#### Enable Required APIs
```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  sql-component.googleapis.com \
  aiplatform.googleapis.com \
  documentai.googleapis.com \
  storage-component.googleapis.com \
  firestore.googleapis.com
```

#### Create Service Accounts
```bash
# Backend service account
gcloud iam service-accounts create legal-ai-backend-sa \
  --display-name="Legal AI Backend Service Account"

# Frontend service account
gcloud iam service-accounts create legal-ai-frontend-sa \
  --display-name="Legal AI Frontend Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT_ID \
  --member="serviceAccount:legal-ai-backend-sa@$GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

#### Create Secrets
```bash
# Database URL
echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=-

# JWT Secret
echo -n "$JWT_SECRET" | gcloud secrets create jwt-config --data-file=-

# Google Cloud Project ID
echo -n "$GOOGLE_CLOUD_PROJECT_ID" | gcloud secrets create google-cloud-config --data-file=-
```

### 2. Build and Deploy

#### Build Docker Images
```bash
# Build frontend
docker build -t gcr.io/$GOOGLE_CLOUD_PROJECT_ID/legal-ai-frontend:latest \
  -f apps/frontend/Dockerfile.prod .

# Build backend
docker build -t gcr.io/$GOOGLE_CLOUD_PROJECT_ID/legal-ai-backend:latest \
  -f apps/backend/Dockerfile.prod .

# Push images
docker push gcr.io/$GOOGLE_CLOUD_PROJECT_ID/legal-ai-frontend:latest
docker push gcr.io/$GOOGLE_CLOUD_PROJECT_ID/legal-ai-backend:latest
```

#### Deploy Services
```bash
# Deploy backend
gcloud run deploy legal-ai-backend \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT_ID/legal-ai-backend:latest \
  --region $GOOGLE_CLOUD_REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 100 \
  --min-instances 1

# Deploy frontend
gcloud run deploy legal-ai-frontend \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT_ID/legal-ai-frontend:latest \
  --region $GOOGLE_CLOUD_REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 50 \
  --min-instances 0
```

### 3. Database Setup

#### Run Migrations
```bash
# Create migration job
gcloud run jobs create legal-ai-migrations \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT_ID/legal-ai-backend:latest \
  --region $GOOGLE_CLOUD_REGION \
  --memory 1Gi \
  --cpu 1 \
  --command npm \
  --args run,migrate

# Execute migrations
gcloud run jobs execute legal-ai-migrations --region $GOOGLE_CLOUD_REGION --wait
```

## CI/CD Pipeline

### GitHub Actions Setup
1. Add repository secrets:
   - `GOOGLE_CLOUD_PROJECT_ID`
   - `GOOGLE_CLOUD_SA_KEY` (Service account JSON key)
   - `DATABASE_URL`
   - `JWT_SECRET`

2. The pipeline automatically:
   - Runs tests on pull requests
   - Builds and deploys on merge to main
   - Runs deployment verification tests

### Cloud Build Triggers
```bash
# Create build trigger
gcloud builds triggers create github \
  --repo-name=legal-document-ai-assistant \
  --repo-owner=your-username \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

## Monitoring and Observability

### Health Checks
- Frontend: `https://your-frontend-url/api/health`
- Backend: `https://your-backend-url/health`

### Metrics Endpoints
- Performance metrics: `https://your-backend-url/api/metrics`
- System health: `https://your-backend-url/health`

### Logging
```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=legal-ai-backend" --limit 50

# Set up log-based alerts
gcloud alpha logging sinks create error-sink \
  bigquery.googleapis.com/projects/$GOOGLE_CLOUD_PROJECT_ID/datasets/logs \
  --log-filter='severity>=ERROR'
```

## Auto-scaling Configuration

### Backend Scaling
- **Min instances**: 1 (always warm)
- **Max instances**: 100
- **Target concurrency**: 80 requests per instance
- **CPU threshold**: 70%
- **Memory threshold**: 80%

### Frontend Scaling
- **Min instances**: 0 (scale to zero)
- **Max instances**: 50
- **Target concurrency**: 100 requests per instance
- **CPU threshold**: 60%
- **Memory threshold**: 70%

## Security Configuration

### Network Security
- VPC connector for private communication
- Cloud Armor for DDoS protection
- SSL/TLS termination at load balancer

### Application Security
- Service accounts with minimal permissions
- Secrets stored in Secret Manager
- Security headers enabled
- Input validation and sanitization

## Performance Optimization

### Caching Strategy
- **API responses**: 5-30 minutes TTL
- **Static assets**: 1 year with versioning
- **Database queries**: 1-5 minutes TTL
- **AI responses**: 30 minutes TTL

### Resource Allocation
- **Backend**: 2 CPU, 2GB RAM
- **Frontend**: 1 CPU, 1GB RAM
- **Database**: Optimized for read-heavy workloads

## Troubleshooting

### Common Issues

#### Deployment Failures
```bash
# Check build logs
gcloud builds log BUILD_ID

# Check service logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

#### Performance Issues
```bash
# Check metrics
gcloud monitoring metrics list --filter="resource.type=cloud_run_revision"

# Analyze traces
gcloud trace list-traces --limit=10
```

#### Database Connection Issues
```bash
# Test database connectivity
gcloud sql connect INSTANCE_NAME --user=USERNAME

# Check connection pool metrics
gcloud monitoring metrics list --filter="metric.type=cloudsql.googleapis.com/database/postgresql/num_backends"
```

### Rollback Procedure
```bash
# List revisions
gcloud run revisions list --service=legal-ai-backend --region=$GOOGLE_CLOUD_REGION

# Rollback to previous revision
gcloud run services update-traffic legal-ai-backend \
  --to-revisions=REVISION_NAME=100 \
  --region=$GOOGLE_CLOUD_REGION
```

## Cost Optimization

### Resource Right-sizing
- Monitor CPU and memory utilization
- Adjust instance sizes based on actual usage
- Use preemptible instances for batch jobs

### Auto-scaling Tuning
- Set appropriate min/max instances
- Optimize concurrency settings
- Use scale-to-zero for development environments

### Storage Optimization
- Implement lifecycle policies for Cloud Storage
- Use appropriate storage classes
- Clean up unused resources regularly

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and rotate secrets quarterly
- Analyze performance metrics weekly
- Update auto-scaling parameters based on usage patterns

### Backup Strategy
- Database: Automated daily backups with 30-day retention
- Secrets: Versioned in Secret Manager
- Configuration: Stored in version control

## Support and Documentation

### Useful Commands
```bash
# Get service URLs
gcloud run services list --platform=managed --region=$GOOGLE_CLOUD_REGION

# Check service status
gcloud run services describe SERVICE_NAME --region=$GOOGLE_CLOUD_REGION

# View real-time logs
gcloud logging tail "resource.type=cloud_run_revision"

# Scale service manually
gcloud run services update SERVICE_NAME \
  --min-instances=2 --max-instances=200 \
  --region=$GOOGLE_CLOUD_REGION
```

### Additional Resources
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Monitoring Documentation](https://cloud.google.com/monitoring/docs)