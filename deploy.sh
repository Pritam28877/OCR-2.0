#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define variables
PROJECT_ID="encoded-joy-472514-n7"
SERVICE_NAME="ocr-ai"
REGION="asia-south1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
CREDENTIALS_FILE="encoded-joy-472514-n7-firebase-adminsdk-fbsvc-a4f5f0e1a6.json"

# Check if the credentials file exists
if [ ! -f "$CREDENTIALS_FILE" ]; then
  echo "Error: Credentials file not found at $CREDENTIALS_FILE"
  exit 1
fi

# Read and Base64 encode the credentials
echo "Encoding credentials..."
CREDENTIALS_BASE64=$(base64 -w 0 "$CREDENTIALS_FILE")

# Build the Docker image
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

# Push the Docker image to Google Container Registry
echo "Pushing Docker image to GCR..."
docker push "$IMAGE_NAME"

# Deploy the new image to Cloud Run with the Base64 credential
echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform "managed" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "FIREBASE_CREDENTIALS_BASE64=$CREDENTIALS_BASE64"

echo "Deployment successful!"