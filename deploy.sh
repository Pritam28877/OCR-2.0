#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define variables
PROJECT_ID="encoded-joy-472514-n7"
SERVICE_NAME="ocr-ai"
REGION="asia-south1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
ENV_FILE=".env"

# Check if the .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  echo "Please create a .env file with your Firebase credentials."
  exit 1
fi

# Build the Docker image
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

# Push the Docker image to Google Container Registry
echo "Pushing Docker image to GCR..."
docker push "$IMAGE_NAME"

# Deploy the new image to Cloud Run with environment variables from .env file
echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform "managed" \
  --region "$REGION" \
  --allow-unauthenticated \
  --env-vars-from-file="$ENV_FILE"

echo "Deployment successful!"