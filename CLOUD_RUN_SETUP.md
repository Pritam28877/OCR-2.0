# Cloud Run Build and Deploy Configuration

## Build Commands

### Build the Docker image
```bash
docker build -t ocr-backend .
```

### Test locally
```bash
docker run -p 8080:8080 --env-file .env ocr-backend
```

## Deploy to Google Cloud Run

### Prerequisites
1. Install Google Cloud SDK
2. Authenticate: `gcloud auth login`
3. Set project: `gcloud config set project YOUR_PROJECT_ID`

### Deploy Commands

#### Deploy using source code (recommended)
```bash
gcloud run deploy ocr-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production
```

#### Deploy using pre-built image
```bash
# Build and tag for Google Container Registry
docker build -t gcr.io/YOUR_PROJECT_ID/ocr-backend .
docker push gcr.io/YOUR_PROJECT_ID/ocr-backend

# Deploy to Cloud Run
gcloud run deploy ocr-backend \
  --image gcr.io/YOUR_PROJECT_ID/ocr-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1
```

## Environment Variables for Cloud Run

You'll need to set these environment variables in Cloud Run:

```bash
gcloud run services update ocr-backend \
  --set-env-vars MONGODB_URI="your-mongodb-connection-string" \
  --set-env-vars FIREBASE_PROJECT_ID="your-firebase-project-id" \
  --set-env-vars FIREBASE_PRIVATE_KEY_ID="your-private-key-id" \
  --set-env-vars FIREBASE_PRIVATE_KEY="your-private-key" \
  --set-env-vars FIREBASE_CLIENT_EMAIL="your-client-email" \
  --set-env-vars FIREBASE_CLIENT_ID="your-client-id" \
  --set-env-vars GEMINI_API_KEY="your-gemini-api-key" \
  --set-env-vars NODE_ENV="production" \
  --region us-central1
```

## Security Notes

- Never commit your .env file to version control
- Use Google Cloud Secret Manager for sensitive data in production
- The Dockerfile creates a non-root user for better security
- CORS is configured - update FRONTEND_URL for production