@echo off
REM Build and Deploy Script for Google Cloud Run (Windows)
REM Make sure you have gcloud CLI installed and authenticated

set PROJECT_ID=%1
if "%PROJECT_ID%"=="" set PROJECT_ID=your-project-id

set SERVICE_NAME=ocr-backend
set REGION=us-central1

echo 🚀 Building and deploying OCR Backend to Google Cloud Run...
echo Project ID: %PROJECT_ID%
echo Service Name: %SERVICE_NAME%
echo Region: %REGION%

echo 📦 Deploying from source code...
gcloud run deploy %SERVICE_NAME% ^
  --source . ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --port 8080 ^
  --memory 512Mi ^
  --cpu 1 ^
  --timeout 300 ^
  --max-instances 10 ^
  --set-env-vars NODE_ENV=production ^
  --project %PROJECT_ID%

echo ✅ Deployment complete!
echo 🌐 Getting service URL...
gcloud run services describe %SERVICE_NAME% --platform managed --region %REGION% --format "value(status.url)" --project %PROJECT_ID%