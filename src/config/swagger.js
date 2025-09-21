const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OCR Product Quotation System API',
      version: '1.0.0',
      description: `
        A comprehensive API for managing product catalogs and generating quotations from handwritten/image-based product lists using OCR technology.
        
        ## Features
        - **Product Management**: CRUD operations, CSV import, search with fuzzy matching
        - **OCR Processing**: Google Vision API integration for text extraction from images
        - **Quotation System**: Create, manage, and track quotations with automatic product matching
        - **File Upload**: Support for images (JPEG, PNG, PDF) and CSV files
        - **Statistics**: Product and quotation analytics
        
        ## Authentication
        Currently, authentication is disabled for development purposes. This can be enabled by setting DISABLE_AUTH=false in the environment variables.
        
        ## Rate Limiting
        API requests are rate-limited to prevent abuse. Default limits: 100 requests per minute per IP.
        
        ## Error Handling
        All endpoints return consistent error responses with appropriate HTTP status codes and detailed error messages.
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-production-domain.com/api' 
          : `http://localhost:${process.env.PORT || 8080}/api`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication (currently disabled)'
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad request - Invalid input parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'string',
                    example: 'Validation failed'
                  },
                  details: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing authentication',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'string',
                    example: 'Unauthorized access'
                  }
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'string',
                    example: 'Resource not found'
                  }
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'string',
                    example: 'Internal server error'
                  },
                  stack: {
                    type: 'string',
                    description: 'Error stack trace (development only)'
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Products',
        description: 'Product catalog management operations'
      },
      {
        name: 'Quotations',
        description: 'Quotation management and OCR processing operations'
      },
      {
        name: 'System',
        description: 'System health and information endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './server.js'
  ]
};

const specs = swaggerJsdoc(options);

const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add any request interceptors here
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
    .swagger-ui .info .title { color: #3b4151 }
    .swagger-ui .scheme-container { background: #f7f7f7; padding: 15px; border-radius: 4px; margin: 20px 0 }
  `,
  customSiteTitle: 'OCR Quotation API Documentation',
  customfavIcon: '/favicon.ico'
};

module.exports = {
  specs,
  swaggerUi,
  swaggerOptions
};
