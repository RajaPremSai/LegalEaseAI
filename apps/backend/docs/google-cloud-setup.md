# Google Cloud Infrastructure Setup

This document provides comprehensive instructions for setting up the Google Cloud infrastructure required for the Legal Document AI Assistant.

## Prerequisites

1. **Google Cloud Account**: Active Google Cloud Platform account with billing enabled
2. **Google Cloud CLI**: Install and configure `gcloud` CLI tool
3. **Node.js**: Version 18+ with npm/yarn
4. **Service Account**: Google Cloud service account with appropriate permissions

## Required Google Cloud APIs

Enable the following APIs in your Google Cloud project:

```bash
gcloud services enable documentai.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable translate.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable run.googleapis.com
```

## Service Account Setup

### 1. Create Service Account

```bash
gcloud iam service-accounts create legal-ai-backend \
    --description="Service account for Legal AI Assistant backend" \
    --display-name="Legal AI Backend"
```

### 2. Grant Required Roles

```bash
# Document AI permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:legal-ai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/documentai.apiUser"

# Firestore permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:legal-ai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

# Cloud Storage permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:legal-ai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# Translation API permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:legal-ai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudtranslate.user"
```

### 3. Generate Service Account Key

```bash
gcloud iam service-accounts keys create ./service-account.json \
    --iam-account=legal-ai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## Document AI Processor Setup

### 1. Create Document AI Processor

```bash
# Create a general form processor
gcloud documentai processors create \
    --location=us \
    --display-name="Legal Document Processor" \
    --type=FORM_PARSER_PROCESSOR
```

### 2. Note the Processor ID

The command above will return a processor ID. Save this for your environment configuration.

## Cloud Storage Setup

### 1. Create Storage Buckets

```bash
# Documents bucket (with lifecycle policy)
gsutil mb -l us-central1 gs://YOUR_PROJECT_ID-legal-documents
gsutil lifecycle set bucket-lifecycle.json gs://YOUR_PROJECT_ID-legal-documents

# Temporary files bucket
gsutil mb -l us-central1 gs://YOUR_PROJECT_ID-legal-temp
```

### 2. Bucket Lifecycle Configuration

Create `bucket-lifecycle.json`:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 1}
      }
    ]
  }
}
```

### 3. Set Bucket Permissions

```bash
# Set uniform bucket-level access
gsutil uniformbucketlevelaccess set on gs://YOUR_PROJECT_ID-legal-documents
gsutil uniformbucketlevelaccess set on gs://YOUR_PROJECT_ID-legal-temp

# Grant service account access
gsutil iam ch serviceAccount:legal-ai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com:roles/storage.objectAdmin gs://YOUR_PROJECT_ID-legal-documents
gsutil iam ch serviceAccount:legal-ai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com:roles/storage.objectAdmin gs://YOUR_PROJECT_ID-legal-temp
```

## Firestore Setup

### 1. Initialize Firestore

```bash
# Create Firestore database in native mode
gcloud firestore databases create --location=us-central1
```

### 2. Deploy Security Rules

```bash
# Deploy the security rules
firebase deploy --only firestore:rules
```

### 3. Create Indexes

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "documents",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "userId", "order": "ASCENDING"},
        {"fieldPath": "uploadedAt", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "documents",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "userId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "uploadedAt", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "analyses",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "userId", "order": "ASCENDING"},
        {"fieldPath": "generatedAt", "order": "DESCENDING"}
      ]
    }
  ]
}
```

Deploy indexes:

```bash
firebase deploy --only firestore:indexes
```

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Update Environment Variables

```env
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-actual-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_CLOUD_PROCESSOR_ID=your-processor-id-from-step-above
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Storage Configuration
DOCUMENTS_BUCKET=your-project-id-legal-documents
TEMP_BUCKET=your-project-id-legal-temp

# Authentication
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# Other configurations...
```

## Automated Setup

Run the automated setup script:

```bash
# Install dependencies
npm install

# Run the setup script
npm run setup:gcloud
```

This script will:
- Initialize Google Cloud services
- Test connectivity to all APIs
- Set up Cloud Storage buckets
- Configure Firestore database
- Verify the complete setup

## Testing the Setup

### 1. Run Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific Google Cloud tests
npm test -- --testPathPattern=google-cloud
```

### 2. Manual Verification

```bash
# Test Document AI
gcloud documentai processors list --location=us

# Test Cloud Storage
gsutil ls gs://YOUR_PROJECT_ID-legal-documents

# Test Firestore
gcloud firestore collections list
```

## Security Considerations

### 1. Service Account Security

- Store service account keys securely
- Rotate keys regularly
- Use least privilege principle
- Monitor service account usage

### 2. Storage Security

- Enable uniform bucket-level access
- Set appropriate lifecycle policies
- Monitor access logs
- Use signed URLs for temporary access

### 3. Firestore Security

- Deploy comprehensive security rules
- Validate all data inputs
- Monitor database usage
- Set up audit logging

## Monitoring and Logging

### 1. Enable Cloud Logging

```bash
gcloud logging sinks create legal-ai-logs \
    bigquery.googleapis.com/projects/YOUR_PROJECT_ID/datasets/legal_ai_logs \
    --log-filter='resource.type="cloud_function" OR resource.type="cloud_run_revision"'
```

### 2. Set Up Monitoring

```bash
# Create notification channel
gcloud alpha monitoring channels create \
    --display-name="Legal AI Alerts" \
    --type=email \
    --channel-labels=email_address=your-email@example.com
```

### 3. Configure Alerts

Set up alerts for:
- API quota limits
- Storage usage
- Error rates
- Authentication failures

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Verify service account has correct roles
   - Check API enablement
   - Validate credentials file

2. **Bucket Access Issues**
   - Confirm bucket names in environment
   - Verify IAM permissions
   - Check bucket location settings

3. **Firestore Connection Problems**
   - Ensure Firestore is initialized
   - Verify security rules
   - Check network connectivity

4. **Document AI Processor Issues**
   - Confirm processor is created and active
   - Verify processor ID in environment
   - Check API quotas

### Debug Commands

```bash
# Check service account permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:legal-ai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# Test API connectivity
gcloud documentai processors list --location=us
gcloud firestore collections list
gsutil ls

# Check quotas
gcloud compute project-info describe --format="table(quotas.metric,quotas.limit,quotas.usage)"
```

## Production Deployment

### 1. Environment-Specific Configuration

- Use separate projects for dev/staging/prod
- Implement proper secret management
- Set up CI/CD pipelines
- Configure monitoring and alerting

### 2. Security Hardening

- Enable VPC Service Controls
- Set up Private Google Access
- Implement network security policies
- Regular security audits

### 3. Backup and Disaster Recovery

- Set up Firestore backups
- Implement cross-region replication
- Document recovery procedures
- Test disaster recovery plans

## Cost Optimization

### 1. Storage Optimization

- Set appropriate lifecycle policies
- Use regional storage for frequently accessed data
- Monitor storage usage and costs

### 2. API Usage Optimization

- Implement caching strategies
- Batch API requests where possible
- Monitor API quotas and usage

### 3. Compute Optimization

- Use Cloud Run for auto-scaling
- Implement proper resource limits
- Monitor and optimize cold starts

## Support and Resources

- [Google Cloud Documentation](https://cloud.google.com/docs)
- [Document AI Documentation](https://cloud.google.com/document-ai/docs)
- [Firestore Documentation](https://cloud.google.com/firestore/docs)
- [Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Google Cloud Support](https://cloud.google.com/support)