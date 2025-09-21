# OCR Product Quotation System - Backend API

A comprehensive Node.js backend API for managing product catalogs and generating quotations from handwritten/image-based product lists using Google Vision OCR technology.

## Features

- **Product Management**: CRUD operations, CSV import/export, advanced search with fuzzy matching
- **OCR Processing**: Google Vision API integration for text extraction from images
- **Quotation System**: Create, manage, and track quotations with automatic product matching
- **File Upload**: Support for images (JPEG, PNG, PDF) and CSV files
- **Statistics & Analytics**: Product and quotation insights
- **API Documentation**: Complete Swagger/OpenAPI documentation
- **Rate Limiting**: Built-in protection against API abuse
- **Error Handling**: Comprehensive error handling and validation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **OCR**: Google Cloud Vision API
- **Search**: Fuse.js for fuzzy matching
- **File Upload**: Multer
- **Documentation**: Swagger/OpenAPI 3.0
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express Validator

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- Google Cloud Platform account with Vision API enabled
- Google Cloud Service Account credentials

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ocr-2-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Google Cloud credentials**
   - Create a service account in Google Cloud Console
   - Enable the Vision API
   - Download the service account key JSON file
   - Rename it to `auth.json` and place it in the project root
   - Or use the example file: `cp auth.json.example auth.json` and fill in your credentials

4. **Configure environment variables**
   - The `.env` file is already configured
   - Update `MONGODB_URI` if needed
   - Update `GOOGLE_CLOUD_PROJECT_ID` to match your Google Cloud project
   - Adjust other settings as needed

## Environment Variables

```env
# Server Configuration
PORT=8080

# Database - MongoDB
MONGODB_URI=your_mongodb_connection_string

# Authentication (currently disabled for development)
JWT_SECRET=your_jwt_secret
DISABLE_AUTH=true

# File Storage
UPLOAD_DIR=./uploads

# OCR Configuration
OCR_PROVIDER=google_vision
OCR_LANGS=en

# Google Cloud Configuration
GOOGLE_APPLICATION_CREDENTIALS=./auth.json
GOOGLE_CLOUD_PROJECT_ID=your-google-cloud-project-id

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:8080`

## API Documentation

Once the server is running, access the interactive API documentation at:
- **Swagger UI**: http://localhost:8080/api-docs
- **API Base URL**: http://localhost:8080/api

## API Endpoints

### Products
- `GET /api/products` - Get all products with pagination
- `GET /api/products/search` - Search products (with fuzzy matching)
- `GET /api/products/categories` - Get product categories
- `GET /api/products/stats` - Get product statistics
- `GET /api/products/template` - Download CSV import template
- `POST /api/products/import` - Import products from CSV
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product (soft delete)

### Quotations
- `GET /api/quotations` - Get all quotations with pagination
- `GET /api/quotations/stats` - Get quotation statistics
- `POST /api/quotations/upload` - Upload image for OCR processing
- `POST /api/quotations/from-ocr` - Create quotation from OCR results
- `GET /api/quotations/:id` - Get single quotation
- `POST /api/quotations` - Create new quotation
- `PUT /api/quotations/:id` - Update quotation
- `DELETE /api/quotations/:id` - Delete quotation
- `POST /api/quotations/:id/duplicate` - Duplicate quotation
- `POST /api/quotations/:id/items` - Add item to quotation
- `PUT /api/quotations/:id/items/:itemId` - Update quotation item
- `DELETE /api/quotations/:id/items/:itemId` - Remove quotation item

### System
- `GET /api/health` - Health check
- `GET /api` - API information

## Usage Examples

### 1. Import Products from CSV

```bash
curl -X POST http://localhost:8080/api/products/import \
  -F "csvFile=@products.csv"
```

### 2. Upload Image for OCR Processing

```bash
curl -X POST http://localhost:8080/api/quotations/upload \
  -F "image=@handwritten-list.jpg"
```

### 3. Create Product

```bash
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Headphones",
    "sku": "WH-001",
    "price": 199.99,
    "description": "High-quality wireless headphones",
    "categories": ["Electronics", "Audio"]
  }'
```

### 4. Search Products

```bash
# Exact search
curl "http://localhost:8080/api/products/search?query=headphones"

# Fuzzy search
curl "http://localhost:8080/api/products/search?query=headfones&fuzzy=true"
```

## File Upload Specifications

### Images (OCR Processing)
- **Supported formats**: JPEG, JPG, PNG, PDF
- **Maximum size**: 10MB per file
- **Maximum files**: 5 files per request

### CSV Import
- **Supported format**: CSV only
- **Maximum size**: 5MB
- **Required columns**: name, sku, price
- **Optional columns**: description, categories

## CSV Import Format

Download the template from `/api/products/template` or use this format:

```csv
name,sku,price,description,categories
"Wireless Headphones","WH-001",199.99,"High-quality wireless headphones","Electronics,Audio"
"Bluetooth Speaker","BS-002",89.99,"Portable bluetooth speaker","Electronics,Audio"
```

## OCR Processing Workflow

1. **Upload Image**: Send image file to `/api/quotations/upload`
2. **Text Extraction**: Google Vision API extracts text from image
3. **Data Parsing**: System parses product names, quantities, and prices
4. **Product Matching**: Fuzzy matching against product database
5. **Review Results**: Manual verification of matched products
6. **Create Quotation**: Generate quotation from verified data

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": ["Additional error details"]
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Configurable**: Set `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`
- **Headers**: Rate limit info included in response headers

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: Comprehensive validation
- **File Upload Security**: Type and size restrictions

## Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/          # Database models
├── routes/          # API routes
└── utils/           # Utility functions
uploads/             # File upload directory
server.js           # Main server file
```

### Adding New Features

1. **Models**: Add to `src/models/`
2. **Controllers**: Add to `src/controllers/`
3. **Routes**: Add to `src/routes/`
4. **Middleware**: Add to `src/middleware/`
5. **Documentation**: Update Swagger comments

## Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production MongoDB URI
3. Set up proper Google Cloud credentials
4. Configure CORS for production domain
5. Set secure JWT secret

### Docker (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

## Monitoring

- **Health Check**: `/api/health`
- **Logs**: Morgan logging middleware
- **Error Tracking**: Comprehensive error handling
- **Performance**: Request timing in logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Update documentation
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Check the API documentation at `/api-docs`
- Review error messages and logs
- Check environment configuration
- Verify Google Cloud credentials and permissions
