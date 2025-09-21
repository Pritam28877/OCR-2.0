# Firebase Phone Number Authentication Setup Guide

Complete end-to-end setup guide for implementing Firebase phone number authentication with OTP verification in your OCR Product Quotation System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [GCP Project Setup](#gcp-project-setup)
3. [Firebase Console Setup](#firebase-console-setup)
4. [Phone Authentication Configuration](#phone-authentication-configuration)
5. [Getting Credentials](#getting-credentials)
6. [Backend Integration](#backend-integration)
7. [Frontend Implementation](#frontend-implementation)
8. [Testing the Setup](#testing-the-setup)
9. [Troubleshooting](#troubleshooting)
10. [Security Best Practices](#security-best-practices)

## Prerequisites

- Google Cloud Platform account
- Access to Firebase Console
- Node.js backend application (already set up)
- Frontend application (React/Vue/Angular/etc.)

## GCP Project Setup

### Step 1: Create or Select a GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project" or select an existing project
4. If creating new:
   - **Project Name**: `ocr-quotation-system` (or your preferred name)
   - **Project ID**: Will be auto-generated (note this down)
   - **Organization**: Select your organization
   - Click "Create"

### Step 2: Enable Required APIs

1. In the GCP Console, navigate to **APIs & Services > Library**
2. Enable the following APIs:
   - **Firebase Authentication API**
   - **Identity and Access Management (IAM) API**
   - **Cloud Resource Manager API**

## Firebase Console Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Select your existing GCP project or create new one
4. **Project Name**: Use the same as your GCP project
5. **Enable Google Analytics**: Choose based on your needs
6. Click "Create project"

### Step 2: Add Web App to Firebase Project

1. In Firebase Console, click on the gear icon > Project settings
2. In the "Your apps" section, click the web icon `</>`
3. **App nickname**: `OCR Quotation Web App`
4. **Enable Firebase Hosting**: Optional
5. Click "Register app"
6. **Copy the Firebase configuration** - you'll need this for frontend
7. Click "Continue to console"

## Phone Authentication Configuration

### Step 1: Enable Phone Authentication

1. In Firebase Console, go to **Authentication > Sign-in method**
2. Click on **Phone** in the Sign-in providers section
3. **Enable** the Phone provider
4. Click "Save"

### Step 2: Configure Phone Numbers for Testing (Optional)

1. In the Phone sign-in section, scroll down to **Phone numbers for testing**
2. Add test phone numbers with corresponding verification codes:
   ```
   Phone Number: +1 234 567 8900
   Verification Code: 123456
   ```
3. This allows testing without sending actual SMS

### Step 3: Configure SMS Provider (Production)

For production use, you need to configure SMS delivery:

1. Go to **Authentication > Settings > Phone Auth**
2. Configure one of the supported SMS providers:
   - **Twilio** (recommended)
   - **Vonage** (formerly Nexmo)
   - **Firebase Cloud Messaging**

## Getting Credentials

### Step 1: Create Service Account for Backend

1. In GCP Console, go to **IAM & Admin > Service Accounts**
2. Click "Create Service Account"
3. **Service account name**: `firebase-auth-service`
4. **Service account ID**: `firebase-auth-service`
5. **Description**: `Service account for Firebase Authentication in OCR system`
6. Click "Create and continue"

### Step 2: Assign Roles

Assign the following roles to your service account:
- **Firebase Admin SDK Administrator Service Agent**
- **Firebase Authentication Admin**
- **Service Account Token Creator**

### Step 3: Generate Private Key

1. Click on the created service account
2. Go to **Keys** tab
3. Click "Add Key > Create new key"
4. Select **JSON** format
5. Click "Create"
6. **Save the downloaded file securely** - this is your `auth.json`

### Step 4: Get Frontend Configuration

1. In Firebase Console, go to **Project Settings > General**
2. Scroll to "Your apps" section
3. Click on your web app
4. Copy the **Firebase configuration object**:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## Backend Integration

### Step 1: Update Environment Variables

Create or update your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./auth.json

# Disable auth for development (set to false for production)
DISABLE_AUTH=false

# Other existing configurations...
MONGODB_URI=your_mongodb_uri
PORT=8080
JWT_SECRET=your-jwt-secret
```

### Step 2: Place Service Account Key

1. Place the downloaded JSON file in your project root
2. Rename it to `auth.json`
3. **Never commit this file to version control**
4. Add `auth.json` to your `.gitignore` file

### Step 3: Install Dependencies (Already Done)

The required dependencies are already installed:
- `firebase-admin`: For server-side Firebase operations

### Step 4: Test Backend Setup

Start your server and check the logs:

```bash
npm run dev
```

You should see:
```
🔥 Firebase Admin SDK initialized successfully
🔐 Authentication: Enabled (Firebase Phone Auth)
```

## Frontend Implementation

### Step 1: Install Firebase SDK

```bash
npm install firebase
```

### Step 2: Initialize Firebase

Create `src/config/firebase.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

export default app;
```

### Step 3: Implement Phone Authentication

Create `src/services/authService.js`:

```javascript
import { 
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from '../config/firebase';

class AuthService {
  constructor() {
    this.recaptchaVerifier = null;
    this.confirmationResult = null;
  }

  // Initialize reCAPTCHA
  initRecaptcha(elementId = 'recaptcha-container') {
    if (!this.recaptchaVerifier) {
      this.recaptchaVerifier = new RecaptchaVerifier(elementId, {
        size: 'normal',
        callback: (response) => {
          console.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
        }
      }, auth);
    }
    return this.recaptchaVerifier;
  }

  // Send OTP
  async sendOTP(phoneNumber) {
    try {
      if (!this.recaptchaVerifier) {
        throw new Error('reCAPTCHA not initialized');
      }

      // Send OTP
      this.confirmationResult = await signInWithPhoneNumber(
        auth, 
        phoneNumber, 
        this.recaptchaVerifier
      );

      console.log('OTP sent successfully');
      return { success: true, message: 'OTP sent successfully' };
      
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      // Reset reCAPTCHA on error
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
        this.recaptchaVerifier = null;
      }
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Verify OTP
  async verifyOTP(otp) {
    try {
      if (!this.confirmationResult) {
        throw new Error('No OTP confirmation available. Please send OTP first.');
      }

      // Verify OTP
      const result = await this.confirmationResult.confirm(otp);
      const user = result.user;

      // Get ID token
      const idToken = await user.getIdToken();

      // Send token to backend for verification
      const response = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          phoneNumber: user.phoneNumber
        })
      });

      const data = await response.json();

      if (data.success) {
        // Store tokens
        localStorage.setItem('authToken', idToken);
        localStorage.setItem('userData', JSON.stringify(data.data.user));
        
        return { 
          success: true, 
          user: data.data.user,
          token: idToken
        };
      } else {
        throw new Error(data.error);
      }

    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Sign out
  async signOut() {
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      
      // Clear reCAPTCHA
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
        this.recaptchaVerifier = null;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user
  getCurrentUser() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  }

  // Get auth token
  getAuthToken() {
    return localStorage.getItem('authToken');
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getAuthToken();
  }
}

export default new AuthService();
```

### Step 4: Create Login Component (React Example)

Create `src/components/Login.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import authService from '../services/authService';

const Login = ({ onLoginSuccess }) => {
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState('+1');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Initialize reCAPTCHA when component mounts
    authService.initRecaptcha('recaptcha-container');
  }, []);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate phone number
    if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
      setError('Please enter a valid phone number in international format');
      setLoading(false);
      return;
    }

    try {
      const result = await authService.sendOTP(phoneNumber);
      
      if (result.success) {
        setStep('otp');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to send OTP. Please try again.');
    }
    
    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      setLoading(false);
      return;
    }

    try {
      const result = await authService.verifyOTP(otp);
      
      if (result.success) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to verify OTP. Please try again.');
    }
    
    setLoading(false);
  };

  const handleBack = () => {
    setStep('phone');
    setOtp('');
    setError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Sign in to OCR Quotation System</h2>
        
        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                required
                disabled={loading}
              />
              <small>Enter your phone number in international format</small>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* reCAPTCHA container */}
            <div id="recaptcha-container"></div>

            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label htmlFor="otp">Verification Code</label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                maxLength="6"
                required
                disabled={loading}
              />
              <small>Enter the 6-digit code sent to {phoneNumber}</small>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="button-group">
              <button type="button" onClick={handleBack} disabled={loading}>
                Back
              </button>
              <button type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
```

### Step 5: Add Authentication to API Calls

Create `src/utils/apiClient.js`:

```javascript
import authService from '../services/authService';

class ApiClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    const token = authService.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // GET request
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload file
  uploadFile(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('image', file);
    
    // Add additional data
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
      },
    });
  }
}

export default new ApiClient();
```

## Testing the Setup

### Step 1: Test Backend Authentication

1. Start your backend server:
   ```bash
   npm run dev
   ```

2. Test the health endpoint:
   ```bash
   curl http://localhost:8080/api/health
   ```

3. Test protected endpoint (should fail without auth):
   ```bash
   curl http://localhost:8080/api/products/stats
   ```

### Step 2: Test Phone Authentication Flow

1. **Frontend Test**: Open your frontend application
2. **Enter Phone Number**: Use a real phone number or test number
3. **Solve reCAPTCHA**: Complete the captcha challenge
4. **Receive OTP**: Check your phone for SMS or use test OTP
5. **Verify OTP**: Enter the 6-digit code
6. **Check Token**: Verify token is stored and API calls work

### Step 3: Test API Endpoints

After successful login, test protected endpoints:

```javascript
// Example API calls with authentication
const apiClient = new ApiClient();

// Get user profile
const userProfile = await apiClient.get('/auth/me');

// Get products (optional auth)
const products = await apiClient.get('/products');

// Create quotation (requires auth)
const quotation = await apiClient.post('/quotations', {
  customerName: 'Test Customer',
  items: []
});

// Upload image for OCR (requires auth)
const ocrResult = await apiClient.uploadFile('/ocr/process-image', imageFile);
```

## Troubleshooting

### Common Issues

#### 1. "Firebase initialization failed"
- **Solution**: Check if `auth.json` exists and has correct format
- Verify the service account has proper roles
- Ensure Firebase project ID matches in config

#### 2. "reCAPTCHA not working"
- **Solution**: Make sure domain is added to Firebase authorized domains
- Check browser console for JavaScript errors
- Ensure reCAPTCHA container element exists in DOM

#### 3. "SMS not being sent"
- **Solution**: Configure SMS provider in Firebase Console
- Check phone number format (E.164 required)
- Verify billing is enabled for production use

#### 4. "Token verification failed"
- **Solution**: Check system clock synchronization
- Verify Firebase project configuration
- Ensure service account has proper permissions

#### 5. "CORS errors in frontend"
- **Solution**: Add frontend domain to Firebase authorized domains
- Configure CORS in your backend if needed

### Debug Mode

Enable debug logging in development:

```javascript
// Frontend debug
import { getAuth, connectAuthEmulator } from 'firebase/auth';

if (process.env.NODE_ENV === 'development') {
  // Connect to auth emulator if running locally
  // connectAuthEmulator(auth, "http://localhost:9099");
  
  // Enable debug logging
  window.firebase_debug = true;
}
```

```javascript
// Backend debug
process.env.GOOGLE_CLOUD_DEBUG = 'true';
```

## Security Best Practices

### 1. Environment Security
- Never commit `auth.json` to version control
- Use environment variables for sensitive data
- Rotate service account keys regularly

### 2. Phone Number Validation
- Always validate phone number format
- Implement rate limiting for OTP requests
- Use proper regional phone number formats

### 3. Frontend Security
- Store tokens securely (consider secure storage libraries)
- Implement automatic token refresh
- Clear tokens on logout

### 4. Backend Security
- Validate all incoming tokens
- Implement proper error handling
- Use HTTPS in production
- Enable rate limiting

### 5. Firebase Security Rules
Set up proper security rules in Firebase Console:

```javascript
// Example Firestore security rules (if using Firestore)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Quotations belong to specific users
    match /quotations/{quotationId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

### 6. Production Considerations
- Set up proper monitoring and alerting
- Configure backup strategies
- Implement proper logging
- Use CDN for static assets
- Enable compression and caching

## API Endpoints Summary

After implementing phone authentication, your API will have these endpoints:

### Authentication Endpoints
- `POST /api/auth/send-otp` - Initiate phone verification
- `POST /api/auth/verify-token` - Complete phone verification
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/logout` - Logout user
- `DELETE /api/auth/account` - Delete user account

### Protected Endpoints
All existing endpoints now support authentication:
- Products: CRUD operations with role-based access
- Quotations: User-specific quotation management
- OCR: Image processing with user context

This completes the Firebase Phone Authentication setup for your OCR Product Quotation System. Users can now authenticate using their phone numbers and access personalized features while maintaining security and proper user management.
