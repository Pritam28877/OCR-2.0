const vision = require('@google-cloud/vision');
const SmartProductMatcher = require('../utils/smartProductMatcher');
const ImagePreprocessor = require('../utils/imagePreprocessor');
const fs = require('fs');
const path = require('path');

/**
 * @desc    Process image with Google Vision OCR and match products
 * @route   POST /api/ocr/process-image
 * @access  Public
 */
const processImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }

    // Initialize Google Vision client
    const client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });

    console.log(`🔍 Processing image: ${req.file.originalname}`);

    // Step 1: Analyze and preprocess image for better OCR
    const preprocessor = new ImagePreprocessor();
    
    // Analyze original image quality
    const qualityAnalysis = await preprocessor.analyzeImageQuality(req.file.path);
    console.log(`📊 Image quality: ${qualityAnalysis.quality.rating} (${qualityAnalysis.quality.score}/100)`);
    
    // Create processed image path
    const processedImagePath = req.file.path.replace(/\.[^/.]+$/, '_processed.jpeg');
    
    // Determine enhancement level based on quality analysis
    let enhancementOptions = {};
    if (qualityAnalysis.quality.score < 40) {
      // Poor quality - use strong enhancement
      enhancementOptions = {
        brightness: 1.3,
        contrast: 1.6,
        saturation: 0.6,
        sharpen: { sigma: 2.5, flat: 1.0, jagged: 3.0 },
        textEnhancement: true,
        edgeEnhancement: true
      };
      console.log(`🔧 Applying strong enhancement for poor quality image`);
    } else if (qualityAnalysis.quality.score < 70) {
      // Fair quality - use medium enhancement
      enhancementOptions = {
        brightness: 1.15,
        contrast: 1.4,
        saturation: 0.7,
        sharpen: { sigma: 2.0, flat: 1.0, jagged: 2.5 },
        textEnhancement: true,
        edgeEnhancement: true
      };
      console.log(`🔧 Applying medium enhancement for fair quality image`);
    } else {
      // Good quality - use light enhancement
      enhancementOptions = {
        brightness: 1.05,
        contrast: 1.2,
        saturation: 0.85,
        sharpen: { sigma: 1.5, flat: 1.0, jagged: 2.0 },
        textEnhancement: true,
        edgeEnhancement: false
      };
      console.log(`🔧 Applying light enhancement for good quality image`);
    }

    // Preprocess image for better OCR
    const preprocessingResult = await preprocessor.preprocessForOCR(
      req.file.path, 
      processedImagePath, 
      enhancementOptions
    );
    
    console.log(`✨ Image preprocessed: ${preprocessingResult.original.sizeKB}KB → ${preprocessingResult.processed.sizeKB}KB`);

    // Step 2: Extract text from processed image using Google Vision API
    const [result] = await client.textDetection(processedImagePath);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      // Clean up uploaded files
      fs.unlinkSync(req.file.path);
      if (fs.existsSync(processedImagePath)) {
        fs.unlinkSync(processedImagePath);
      }
      
      return res.status(400).json({
        success: false,
        error: 'No text detected in the image',
        qualityAnalysis: qualityAnalysis,
        suggestions: [
          'Ensure the image is clear and well-lit',
          'Check that the text is not too small or blurry',
          'Try uploading a higher resolution image',
          ...qualityAnalysis.recommendations
        ]
      });
    }

    const extractedText = detections[0].description;
    const ocrConfidence = detections.length > 1 ? 
      detections.slice(1).reduce((sum, d) => sum + (d.confidence || 0), 0) / (detections.length - 1) : 0;

    console.log(`📝 Extracted text (${extractedText.length} chars, confidence: ${(ocrConfidence * 100).toFixed(1)}%)`);

    // Step 3: Process text with Smart Product Matcher
    const matcher = new SmartProductMatcher();
    const processingResult = await matcher.processOCRText(extractedText);

    // Step 4: Prepare response data
    const originalImageUrl = `/uploads/${path.basename(req.file.path)}`;
    const processedImageUrl = `/uploads/${path.basename(processedImagePath)}`;
    
    const response = {
      success: true,
      message: 'Image processed successfully',
      data: {
        // OCR Results
        ocr: {
          originalText: extractedText,
          confidence: ocrConfidence,
          textLength: extractedText.length,
          detectedLines: extractedText.split('\n').length
        },
        
        // Processing Results
        processing: {
          ...processingResult,
          processingTime: Date.now() - req.startTime
        },
        
        // Image Processing Information
        images: {
          original: {
            name: req.file.originalname,
            size: req.file.size,
            url: originalImageUrl,
            quality: qualityAnalysis
          },
          processed: {
            url: processedImageUrl,
            enhancement: preprocessingResult.enhancement,
            sizeReduction: preprocessingResult.original.sizeKB - preprocessingResult.processed.sizeKB,
            processingTime: Date.now() - req.startTime
          }
        },
        
        // Summary for quick review
        summary: {
          totalItemsFound: processingResult.processedItems.length,
          itemsWithPrices: processingResult.stats.itemsWithPrices,
          itemsRequiringReview: processingResult.stats.itemsRequiringReview,
          averageConfidence: processingResult.stats.averageConfidence,
          processingAccuracy: processingResult.stats.processingAccuracy
        }
      }
    };

    // Log processing summary
    console.log(`✅ Processing complete: ${response.data.summary.totalItemsFound} items, ${response.data.summary.itemsWithPrices} with prices`);

    res.status(200).json(response);

  } catch (error) {
    // Clean up uploaded files if processing failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Clean up processed image if it exists
    const processedImagePath = req.file ? req.file.path.replace(/\.[^/.]+$/, '_processed.jpeg') : null;
    if (processedImagePath && fs.existsSync(processedImagePath)) {
      fs.unlinkSync(processedImagePath);
    }
    
    console.error('OCR Processing Error:', error);
    next(error);
  }
};

/**
 * @desc    Get detailed match information for a specific item
 * @route   POST /api/ocr/get-matches
 * @access  Public
 */
const getDetailedMatches = async (req, res, next) => {
  try {
    const { productText, includeCategories = true, includeKeywords = true } = req.body;

    if (!productText || productText.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Product text is required and must be at least 2 characters'
      });
    }

    const matcher = new SmartProductMatcher();
    await matcher.initialize();

    const matches = matcher.findMatches(productText.trim());
    const suggestions = matcher.generateSuggestions(matches);

    res.status(200).json({
      success: true,
      data: {
        searchText: productText,
        matches: matches,
        suggestions: suggestions,
        searchedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get products by category (for when only category is mentioned)
 * @route   GET /api/ocr/category-products/:category
 * @access  Public
 */
const getProductsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const matcher = new SmartProductMatcher();
    await matcher.initialize();

    // Find products matching the category
    const categoryMatches = matcher.findCategoryMatches(category);
    
    if (categoryMatches.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No products found for category: ${category}`,
        suggestions: [
          'Try searching for: switches, sockets, lights, fans, dimmers',
          'Check spelling of the category name',
          'Use the general search endpoint for broader results'
        ]
      });
    }

    // Combine all products from matching categories
    const allProducts = categoryMatches.reduce((acc, match) => {
      return acc.concat(match.products);
    }, []);

    // Remove duplicates and apply pagination
    const uniqueProducts = allProducts.filter((product, index, self) => 
      index === self.findIndex(p => p._id.toString() === product._id.toString())
    );

    const paginatedProducts = uniqueProducts.slice(skip, skip + limit);
    const total = uniqueProducts.length;
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: {
        category: category,
        products: paginatedProducts,
        matchedCategories: categoryMatches.map(m => ({
          category: m.category,
          productCount: m.products.length,
          matchedKeywords: m.matchedKeywords
        })),
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Analyze image quality for OCR suitability
 * @route   POST /api/ocr/analyze-image
 * @access  Public
 */
const analyzeImageQuality = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }

    const preprocessor = new ImagePreprocessor();
    const analysis = await preprocessor.analyzeImageQuality(req.file.path);
    
    // Clean up uploaded file after analysis
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: 'Image quality analyzed successfully',
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        analysis: analysis,
        recommendations: {
          enhancementLevel: analysis.quality.score < 40 ? 'strong' : 
                           analysis.quality.score < 70 ? 'medium' : 'light',
          ocrSuitability: analysis.quality.rating,
          processingTips: analysis.recommendations
        }
      }
    });

  } catch (error) {
    // Clean up uploaded file if analysis failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Image Analysis Error:', error);
    next(error);
  }
};

/**
 * @desc    Test raw OCR processing without preprocessing or matching
 * @route   POST /api/ocr/test-raw
 * @access  Public
 */
const testRawOCR = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }

    // Initialize Google Vision client
    const client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });

    console.log(`🔍 Testing raw OCR on: ${req.file.originalname}`);

    // Extract text from original image (no preprocessing)
    const [result] = await client.textDetection(req.file.path);
    const detections = result.textAnnotations;

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    if (!detections || detections.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No text detected in image',
        data: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          extractedText: '',
          textLength: 0,
          detectedWords: 0,
          confidence: 0,
          allDetections: []
        }
      });
    }

    // Get full text and individual word detections
    const fullText = detections[0].description;
    const wordDetections = detections.slice(1); // Skip the first one which is full text

    // Calculate average confidence
    const totalConfidence = wordDetections.reduce((sum, detection) => {
      return sum + (detection.confidence || 0);
    }, 0);
    const averageConfidence = wordDetections.length > 0 ? totalConfidence / wordDetections.length : 0;

    // Prepare detailed word information
    const wordDetails = wordDetections.map((detection, index) => ({
      word: detection.description,
      confidence: detection.confidence || 0,
      boundingBox: detection.boundingPoly ? {
        vertices: detection.boundingPoly.vertices
      } : null
    }));

    // Split text into lines for better readability
    const lines = fullText.split('\n').filter(line => line.trim().length > 0);

    console.log(`📝 OCR Results: ${fullText.length} chars, ${wordDetections.length} words, ${(averageConfidence * 100).toFixed(1)}% confidence`);

    res.status(200).json({
      success: true,
      message: 'Raw OCR processing completed',
      data: {
        file: {
          name: req.file.originalname,
          size: req.file.size,
          sizeKB: Math.round(req.file.size / 1024)
        },
        ocr: {
          extractedText: fullText,
          textLength: fullText.length,
          detectedWords: wordDetections.length,
          detectedLines: lines.length,
          averageConfidence: Math.round(averageConfidence * 10000) / 100, // Percentage with 2 decimals
          processingTime: Date.now() - req.startTime
        },
        textByLines: lines,
        wordDetails: wordDetails,
        rawGoogleResponse: {
          totalDetections: detections.length,
          hasFullText: detections.length > 0,
          hasWordDetections: detections.length > 1
        }
      }
    });

  } catch (error) {
    // Clean up uploaded file if processing failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Raw OCR Test Error:', error);
    next(error);
  }
};

/**
 * @desc    Process image and generate quotation in one step
 * @route   POST /api/ocr/generate-quotation
 * @access  Public
 */
const generateQuotationFromImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }

    // Get customer info from request body
    const customerInfo = {
      name: req.body.customerName || 'Unknown Customer',
      email: req.body.customerEmail || '',
      phone: req.body.customerPhone || '',
      address: req.body.customerAddress || ''
    };

    const discountAmount = parseFloat(req.body.appliedDiscount) || 0;

    console.log(`🔍 Generating quotation from image: ${req.file.originalname}`);

    // Step 1: Process image with OCR and product matching
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });

    // Analyze and preprocess image
    const ImagePreprocessor = require('../utils/imagePreprocessor');
    const preprocessor = new ImagePreprocessor();
    
    const qualityAnalysis = await preprocessor.analyzeImageQuality(req.file.path);
    console.log(`📊 Image quality: ${qualityAnalysis.quality.rating} (${qualityAnalysis.quality.score}/100)`);
    
    const processedImagePath = req.file.path.replace(/\.[^/.]+$/, '_processed.jpeg');
    
    // Determine enhancement level
    let enhancementOptions = {};
    if (qualityAnalysis.quality.score < 40) {
      enhancementOptions = {
        brightness: 1.3, contrast: 1.6, saturation: 0.6,
        sharpen: { sigma: 2.5, flat: 1.0, jagged: 3.0 },
        textEnhancement: true, edgeEnhancement: true
      };
    } else if (qualityAnalysis.quality.score < 70) {
      enhancementOptions = {
        brightness: 1.15, contrast: 1.4, saturation: 0.7,
        sharpen: { sigma: 2.0, flat: 1.0, jagged: 2.5 },
        textEnhancement: true, edgeEnhancement: true
      };
    } else {
      enhancementOptions = {
        brightness: 1.05, contrast: 1.2, saturation: 0.85,
        sharpen: { sigma: 1.5, flat: 1.0, jagged: 2.0 },
        textEnhancement: true, edgeEnhancement: false
      };
    }

    const preprocessingResult = await preprocessor.preprocessForOCR(
      req.file.path, processedImagePath, enhancementOptions
    );

    // Step 2: Extract text with Google Vision
    const [result] = await client.textDetection(processedImagePath);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      // Clean up files
      fs.unlinkSync(req.file.path);
      if (fs.existsSync(processedImagePath)) {
        fs.unlinkSync(processedImagePath);
      }
      
      return res.status(400).json({
        success: false,
        error: 'No text detected in the image',
        qualityAnalysis: qualityAnalysis
      });
    }

    const extractedText = detections[0].description;
    console.log(`📝 Extracted text (${extractedText.length} chars)`);

    // Step 3: Process with Smart Product Matcher
    const matcher = new SmartProductMatcher();
    const processingResult = await matcher.processOCRText(extractedText);

    // Step 4: Prepare quotation items from OCR results
    const quotationItems = processingResult.processedItems
      .filter(item => item.productText && item.productText.trim().length > 0) // Filter out empty items
      .map((item, index) => {
        const productName = item.bestMatch ? 
          item.bestMatch.name : 
          (item.productText || item.originalText || `Unknown Product ${index + 1}`);
        
        const itemPrice = item.price > 0 ? item.price : 0; // Ensure non-negative price
        const itemQuantity = item.quantity > 0 ? item.quantity : 1; // Ensure positive quantity
        
        return {
          productId: item.bestMatch ? item.bestMatch._id : null,
          productName: productName.trim(),
          quantity: itemQuantity,
          price: itemPrice,
          matchedByOCR: item.bestMatch ? true : false,
          manualEntry: !item.bestMatch,
          notes: item.bestMatch ? 
            `Auto-matched from OCR (${(item.confidence * 100).toFixed(1)}% confidence)` :
            `No match found for: "${item.originalText}"`,
          confidence: item.confidence,
          originalText: item.originalText,
          suggestions: item.suggestions || []
        };
      });

    // Ensure we have at least one valid item
    if (quotationItems.length === 0) {
      // Clean up files
      fs.unlinkSync(req.file.path);
      if (fs.existsSync(processedImagePath)) {
        fs.unlinkSync(processedImagePath);
      }
      
      return res.status(400).json({
        success: false,
        error: 'No valid products found in the image to create quotation',
        extractedText: extractedText,
        processingStats: processingResult.stats
      });
    }

    // Step 5: Create quotation using existing controller
    const Quotation = require('../models/Quotation');
    
    // Calculate totals for validation
    const calculatedTotal = quotationItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    // Calculate discount percentage if discount amount is provided
    const appliedDiscountPercent = calculatedTotal > 0 ? 
      Math.min((discountAmount / calculatedTotal) * 100, 100) : 0;
    
    // Generate quotation number manually
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const quotationNumber = `QUO-${timestamp}-${random}`;
    
    // Calculate final totals
    const finalTotal = Math.max(0, calculatedTotal - discountAmount);
    
    const quotationData = {
      quotationNumber: quotationNumber,
      items: quotationItems,
      totalPrice: calculatedTotal,
      appliedDiscount: appliedDiscountPercent, // Store as percentage
      discountAmount: discountAmount,
      finalPrice: finalTotal,
      customerInfo: customerInfo,
      status: 'draft',
      ocrData: {
        originalImageName: req.file.originalname,
        extractedText: extractedText,
        processingStats: processingResult.stats,
        imageQuality: qualityAnalysis.quality,
        processedAt: new Date(),
        totalItemsFound: processingResult.processedItems.length,
        itemsWithPrices: processingResult.stats.itemsWithPrices,
        averageConfidence: processingResult.stats.averageConfidence
      }
    };

    const quotation = await Quotation.create(quotationData);
    await quotation.populate('items.productId', 'name sku price description catalogNumber');

    // Step 6: Calculate summary statistics
    const totalItems = quotation.items.length;
    const matchedItems = quotation.items.filter(item => item.productId).length;
    const unmatchedItems = totalItems - matchedItems;
    const totalValue = quotation.totalPrice;
    const finalTotal = totalValue - appliedDiscount;

    // Clean up uploaded files
    fs.unlinkSync(req.file.path);
    if (fs.existsSync(processedImagePath)) {
      fs.unlinkSync(processedImagePath);
    }

    console.log(`✅ Quotation generated: ${quotation.quotationNumber} with ${totalItems} items (${matchedItems} matched)`);

    res.status(201).json({
      success: true,
      message: 'Quotation generated successfully from image',
      data: {
        quotation: quotation,
        summary: {
          quotationNumber: quotation.quotationNumber,
          totalItems: totalItems,
          matchedItems: matchedItems,
          unmatchedItems: unmatchedItems,
          matchingAccuracy: totalItems > 0 ? ((matchedItems / totalItems) * 100).toFixed(1) + '%' : '0%',
          totalValue: totalValue,
          appliedDiscount: discountAmount,
          finalTotal: finalTotal,
          averageConfidence: processingResult.stats.averageConfidence
        },
        processing: {
          imageQuality: qualityAnalysis.quality.rating,
          textLength: extractedText.length,
          processingTime: Date.now() - req.startTime,
          enhancement: preprocessingResult.enhancement
        },
        recommendations: {
          reviewRequired: unmatchedItems > 0 || parseFloat(processingResult.stats.averageConfidence) < 0.8,
          unmatchedItems: quotation.items
            .filter(item => !item.productId)
            .map(item => ({
              originalText: item.originalText,
              productName: item.productName,
              suggestions: item.suggestions
            }))
        }
      }
    });

  } catch (error) {
    // Clean up files on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    const processedImagePath = req.file ? req.file.path.replace(/\.[^/.]+$/, '_processed.jpeg') : null;
    if (processedImagePath && fs.existsSync(processedImagePath)) {
      fs.unlinkSync(processedImagePath);
    }
    
    console.error('Quotation Generation Error:', error);
    next(error);
  }
};

/**
 * @desc    Validate OCR processing capabilities
 * @route   GET /api/ocr/validate
 * @access  Public
 */
const validateOCRSetup = async (req, res, next) => {
  try {
    const checks = {
      googleVisionCredentials: false,
      productDatabase: false,
      uploadDirectory: false
    };

    let allPassed = true;

    // Check Google Vision credentials
    try {
      const client = new vision.ImageAnnotatorClient({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
      });
      // Try to create client without error
      checks.googleVisionCredentials = true;
    } catch (error) {
      checks.googleVisionCredentials = false;
      allPassed = false;
    }

    // Check product database
    try {
      const matcher = new SmartProductMatcher();
      await matcher.initialize();
      checks.productDatabase = matcher.products.length > 0;
      checks.productCount = matcher.products.length;
      
      if (!checks.productDatabase) {
        allPassed = false;
      }
    } catch (error) {
      checks.productDatabase = false;
      allPassed = false;
    }

    // Check upload directory
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    checks.uploadDirectory = fs.existsSync(uploadDir);
    if (!checks.uploadDirectory) {
      allPassed = false;
    }

    res.status(allPassed ? 200 : 500).json({
      success: allPassed,
      message: allPassed ? 'OCR system is ready' : 'OCR system has configuration issues',
      checks: checks,
      recommendations: allPassed ? [] : [
        !checks.googleVisionCredentials ? 'Configure Google Vision API credentials' : null,
        !checks.productDatabase ? 'Import products into database' : null,
        !checks.uploadDirectory ? 'Create uploads directory' : null
      ].filter(Boolean)
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  processImage,
  getDetailedMatches,
  getProductsByCategory,
  analyzeImageQuality,
  testRawOCR,
  generateQuotationFromImage,
  validateOCRSetup
};
