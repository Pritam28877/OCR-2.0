#!/bin/bash

# Build and Deploy Script for Google Cloud Run
# Make sure you have gcloud CLI installed and authenticated

set -e

PROJECT_ID=${1:-"your-project-id"}
SERVICE_NAME="ocr-backend"
REGION="us-central1"

echo "🚀 Building and deploying OCR Backend to Google Cloud Run..."
echo "Project ID: $PROJECT_ID"
echo "Service Name: $SERVICE_NAME"
echo "Region: $REGION"

# Build and deploy using source code
echo "📦 Deploying from source code..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --project $PROJECT_ID

echo "✅ Deployment complete!"
echo "🌐 Your service is available at:"
gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)' --project $PROJECT_ID