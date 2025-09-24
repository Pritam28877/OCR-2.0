# Docker Setup for OCR Backend

This guide explains how to containerize and deploy the OCR Backend application to Google Cloud Run.

## Files Created

- **Dockerfile**: Multi-stage Docker build configuration
- **.dockerignore**: Excludes unnecessary files from Docker build context
- **cloud-run-service.yaml**: Kubernetes service configuration for Cloud Run
- **CLOUD_RUN_SETUP.md**: Detailed deployment instructions
- **deploy.sh** / **deploy.bat**: Automated deployment scripts

## Quick Start

### 1. Local Docker Build & Test

```bash
# Build the image
docker build -t ocr-backend .

# Test locally
docker run -p 8080:8080 --env-file .env ocr-backend
```

### 2. Deploy to Google Cloud Run

#### Option A: Using deployment script (recommended)
```bash
# Linux/Mac
./deploy.sh your-project-id

# Windows
deploy.bat your-project-id
```

#### Option B: Manual deployment
```bash
gcloud run deploy ocr-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production
```

## Key Features

### Docker Optimizations
- **Multi-stage build**: Uses Node.js 18 Alpine for smaller image size
- **Non-root user**: Runs as unprivileged user for security
- **Production dependencies**: Only installs production npm packages
- **Efficient caching**: Optimized layer caching for faster builds

### Cloud Run Optimizations
- **Port 8080**: Cloud Run standard port
- **Host binding**: Binds to 0.0.0.0 for container networking
- **Health checks**: Uses `/health` endpoint for readiness/liveness probes
- **Resource limits**: Configured for efficient resource usage
- **Auto-scaling**: Supports 0-10 instances based on traffic

### Security Features
- Runs as non-root user inside container
- Environment variables for sensitive configuration
- CORS configuration for cross-origin requests
- Helmet.js for security headers
- Rate limiting middleware

## Environment Variables

Set these in Cloud Run for production:

```bash
NODE_ENV=production
PORT=8080
MONGODB_URI=your-mongodb-connection-string
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
GEMINI_API_KEY=your-gemini-api-key
```

## Monitoring & Troubleshooting

- **Health Check**: `GET /health` - Returns service status
- **API Docs**: `GET /api-docs` - Swagger documentation
- **Logs**: View in Google Cloud Console under Cloud Run logs

## File Upload Handling

The application creates an `uploads/csv` directory for file storage. In production, consider using Google Cloud Storage for persistent file storage.

## Next Steps

1. Configure your Google Cloud project
2. Set up environment variables
3. Deploy using the provided scripts
4. Monitor application performance
5. Set up CI/CD pipeline for automatic deployments

For detailed deployment instructions, see `CLOUD_RUN_SETUP.md`.