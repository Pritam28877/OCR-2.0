# OCR Backend API

A comprehensive backend API for OCR (Optical Character Recognition) processing using Google Firebase Authentication and Google Gemini API. Built with Node.js, Express, MongoDB, and includes Swagger documentation.

## Features

- 🔐 **Firebase Authentication** - Secure user authentication and authorization
- 📷 **OCR Processing** - Extract text from images using Google Gemini 2.0 Flash
- 🏪 **Product Management** - Manage product catalog with categories and pricing
- 📋 **Quotation System** - Create and manage quotations with automatic calculations
- 🔄 **Product Matching** - Match OCR extracted data with existing products
- 📊 **Statistics & Analytics** - Get insights from OCR processing and business data
- 📚 **Swagger Documentation** - Comprehensive API documentation
- 🛡️ **Security** - Rate limiting, CORS, helmet security headers

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK
- **OCR**: Google Gemini 2.0 Flash API
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, CORS, Rate Limiting
- **File Upload**: Multer

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- Firebase project with Admin SDK configured
- Google Gemini API key

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ocr-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**

   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   Update the `.env` file with your configuration:

   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/ocr-backend

   # Firebase Configuration
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_PRIVATE_KEY_ID=your-private-key-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----"
   FIREBASE_CLIENT_EMAIL=your-firebase-client-email
   FIREBASE_CLIENT_ID=your-client-id
   FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
   FIREBASE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs

   # Google Gemini API
   GEMINI_API_KEY=your-gemini-api-key

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   ```

## Firebase Setup

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select existing one

2. **Enable Authentication**
   - Go to Authentication > Sign-in method
   - Enable Email/Password or desired providers

3. **Generate Service Account Key**
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Download the JSON file
   - Copy the values to your `.env` file

4. **Get Gemini API Key**
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Create a new API key
   - Add it to your `.env` file

## Database Setup

1. **Local MongoDB**
   ```bash
   # Install MongoDB locally or use Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

2. **MongoDB Atlas (Cloud)**
   - Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a cluster
   - Get connection string and update `MONGODB_URI` in `.env`

## Usage

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Start production server**
   ```bash
   npm start
   ```

3. **Access the API**
   - Server: `http://localhost:3000`
   - API Documentation: `http://localhost:3000/api-docs`
   - Health Check: `http://localhost:3000/health`

## API Endpoints

### Authentication
- `POST /api/auth/verify` - Verify Firebase token
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `DELETE /api/auth/profile` - Delete user account

### OCR Processing
- `POST /api/ocr/process` - Process image with OCR
- `POST /api/ocr/process-data` - Process OCR data
- `GET /api/ocr/history` - Get OCR processing history
- `GET /api/ocr/stats` - Get OCR statistics

### Products
- `GET /api/products` - Get all products
- `GET /api/products/stats` - Get product statistics
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/category/:category` - Get products by category
- `POST /api/products` - Create new product (Admin only)
- `PUT /api/products/:id` - Update product (Admin only)
- `DELETE /api/products/:id` - Delete product (Admin only)

### Quotations
- `GET /api/quotations` - Get all quotations
- `GET /api/quotations/stats` - Get quotation statistics
- `GET /api/quotations/:id` - Get quotation by ID
- `POST /api/quotations` - Create new quotation
- `PUT /api/quotations/:id` - Update quotation
- `PATCH /api/quotations/:id/status` - Update quotation status
- `DELETE /api/quotations/:id` - Delete quotation

## Authentication

The API uses Firebase Authentication. Include the Firebase ID token in the Authorization header:

```bash
Authorization: Bearer <firebase-id-token>
```

## OCR Processing

### Image Upload
Send a POST request to `/api/ocr/process` with a multipart/form-data containing an image file:

```bash
curl -X POST http://localhost:3000/api/ocr/process \\
  -H "Authorization: Bearer <firebase-token>" \\
  -F "image=@/path/to/image.jpg"
```

### Response Format
The OCR service returns structured data in this format:

```json
{
  "products": [
    {
      "item_number": 1,
      "product_name": "Product name here",
      "total_quantity": "Quantity here",
      "sub_quantities": [
        { "color": "Color here", "quantity": "Quantity here" }
      ]
    }
  ]
}
```

## Product Matching

The system automatically matches OCR extracted products with existing database products and provides suggestions for unmatched items.

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for cross-origin requests
- **Helmet**: Security headers
- **Input Validation**: Request validation and sanitization
- **Authentication**: Firebase-based secure authentication

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (not implemented yet)

### Project Structure
```
├── config/
│   ├── database.js     # MongoDB connection
│   └── firebase.js     # Firebase Admin SDK initialization
├── controllers/
│   ├── authController.js
│   ├── ocrController.js
│   ├── productController.js
│   └── quotationController.js
├── models/
│   ├── Product.js
│   ├── Quotation.js
│   └── User.js
├── routes/
│   ├── auth.js
│   ├── ocr.js
│   ├── products.js
│   └── quotations.js
├── services/
│   ├── ocrService.js
│   └── matchingService.js
├── middleware/
│   └── auth.js
├── .env
├── server.js
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support, please contact the development team or create an issue in the repository.

---

**Note**: Make sure to keep your API keys and sensitive configuration secure and never commit them to version control.
