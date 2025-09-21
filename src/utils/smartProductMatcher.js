const Fuse = require('fuse.js');
const Product = require('../models/Product');

class SmartProductMatcher {
  constructor() {
    this.products = [];
    this.fuseOptions = {
      includeScore: true,
      threshold: 0.4, // 0 = exact match, 1 = match anything
      minMatchCharLength: 2,
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'catalogNumber', weight: 0.3 },
        { name: 'description', weight: 0.2 },
        { name: 'categories', weight: 0.1 }
      ]
    };
  }

  /**
   * Initialize with all products from database
   */
  async initialize() {
    this.products = await Product.find({ isActive: true }).lean();
    this.fuse = new Fuse(this.products, this.fuseOptions);
    console.log(`🔍 SmartProductMatcher initialized with ${this.products.length} products`);
  }

  /**
   * Extract structured data from OCR text
   * @param {string} text - Raw OCR text
   * @returns {Array} - Parsed items with quantities and potential matches
   */
  parseOCRText(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 2);
    const items = [];

    // Common patterns for product lists
    const patterns = [
      // Pattern: "Product Name - Quantity" or "Product Name x Quantity"
      /^(.+?)\s*[-–x]\s*(\d+)\s*(?:nos?|pcs?|units?)?/i,
      // Pattern: "Quantity x Product Name" or "Quantity - Product Name"
      /^(\d+)\s*[x-]\s*(.+?)$/i,
      // Pattern: "Product Name Quantity" (space separated)
      /^(.+?)\s+(\d+)\s*(?:nos?|pcs?|units?)?$/i,
      // Pattern: "Catalog Number - Description"
      /^([A-Z0-9\s.]+)\s*[-–]\s*(.+)$/i,
      // Pattern: Just product name or description
      /^(.+)$/i
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      let matched = false;

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          let productText, quantity = 1;

          if (pattern.source.startsWith('^(\\d+)')) {
            // Quantity first patterns
            quantity = parseInt(match[1]);
            productText = match[2].trim();
          } else if (pattern.source.includes('\\d+')) {
            // Product first with quantity
            productText = match[1].trim();
            quantity = parseInt(match[2]) || 1;
          } else {
            // Just product text
            productText = match[1].trim();
          }

          if (productText && productText.length > 2) {
            items.push({
              originalText: line,
              productText: this.cleanProductText(productText),
              quantity: quantity,
              lineNumber: i + 1,
              matchedByOCR: true
            });
            matched = true;
            break;
          }
        }
      }

      // If no pattern matched but line looks like a product
      if (!matched && line.length > 2 && !this.isNoise(line)) {
        items.push({
          originalText: line,
          productText: this.cleanProductText(line),
          quantity: 1,
          lineNumber: i + 1,
          matchedByOCR: false,
          requiresManualReview: true
        });
      }
    }

    return items;
  }

  /**
   * Clean and normalize product text
   * @param {string} text - Raw product text
   * @returns {string} - Cleaned text
   */
  cleanProductText(text) {
    return text
      .replace(/[^\w\s.-]/g, ' ') // Keep alphanumeric, spaces, dots, hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Check if line is likely noise (headers, totals, etc.)
   * @param {string} line - Text line
   * @returns {boolean} - True if likely noise
   */
  isNoise(line) {
    const noisePatterns = [
      /^(total|subtotal|amount|price|qty|quantity|s\.?no|sr\.?no)$/i,
      /^(from|to|page|date)$/i,
      /^\d+$/, // Just numbers
      /^[-=_]+$/, // Just separators
    ];
    
    return noisePatterns.some(pattern => pattern.test(line.trim()));
  }

  /**
   * Find matching products for a given text
   * @param {string} productText - Cleaned product text
   * @returns {Object} - Matching results with confidence scores
   */
  findMatches(productText) {
    const results = {
      exactMatch: null,
      fuzzyMatches: [],
      categoryMatches: [],
      keywordMatches: [],
      confidence: 0
    };

    // 1. Exact name matching (case insensitive)
    const exactMatch = this.products.find(p => 
      p.name.toLowerCase() === productText.toLowerCase() ||
      p.catalogNumber.toLowerCase() === productText.toLowerCase()
    );

    if (exactMatch) {
      results.exactMatch = exactMatch;
      results.confidence = 1.0;
      return results;
    }

    // 2. Fuzzy matching using Fuse.js
    const fuzzyResults = this.fuse.search(productText);
    if (fuzzyResults.length > 0) {
      results.fuzzyMatches = fuzzyResults.slice(0, 5).map(result => ({
        product: result.item,
        confidence: 1 - result.score,
        score: result.score
      }));
      results.confidence = Math.max(results.confidence, results.fuzzyMatches[0].confidence);
    }

    // 3. Category matching
    const categoryMatches = this.findCategoryMatches(productText);
    if (categoryMatches.length > 0) {
      results.categoryMatches = categoryMatches;
      results.confidence = Math.max(results.confidence, 0.3);
    }

    // 4. Keyword matching
    const keywordMatches = this.findKeywordMatches(productText);
    if (keywordMatches.length > 0) {
      results.keywordMatches = keywordMatches;
      results.confidence = Math.max(results.confidence, 0.4);
    }

    return results;
  }

  /**
   * Find products by category keywords
   * @param {string} text - Search text
   * @returns {Array} - Category-based matches
   */
  findCategoryMatches(text) {
    const categoryKeywords = {
      'switch': ['switch', 'switches'],
      'socket': ['socket', 'sockets', 'outlet'],
      'light': ['light', 'lighting', 'lamp', 'bulb'],
      'fan': ['fan', 'regulator'],
      'dimmer': ['dimmer', 'dimming'],
      'indicator': ['indicator', 'led'],
      'buzzer': ['buzzer', 'bell', 'alarm'],
      'usb': ['usb', 'charger'],
      'telephone': ['telephone', 'phone', 'rj11'],
      'data': ['data', 'ethernet', 'rj45', 'network'],
      'tv': ['tv', 'television', 'coaxial'],
      'audio': ['audio', 'speaker', 'music']
    };

    const matches = [];
    const lowerText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        const categoryProducts = this.products.filter(p => 
          p.categories.some(cat => cat.toLowerCase().includes(category)) ||
          p.name.toLowerCase().includes(category)
        );
        
        if (categoryProducts.length > 0) {
          matches.push({
            category: category,
            products: categoryProducts.slice(0, 10), // Limit to 10 per category
            matchedKeywords: keywords.filter(k => lowerText.includes(k))
          });
        }
      }
    }

    return matches;
  }

  /**
   * Find products by technical keywords (amperage, modules, etc.)
   * @param {string} text - Search text
   * @returns {Array} - Keyword-based matches
   */
  findKeywordMatches(text) {
    const technicalKeywords = {
      amperage: ['6a', '16a', '25a', '13a'],
      modules: ['1 module', '2 module', '3 module', '4 module'],
      way: ['one-way', 'two-way', 'one way', 'two way'],
      voltage: ['220v', '110v', '240v'],
      wattage: ['80w', '100w', '500w']
    };

    const matches = [];
    const lowerText = text.toLowerCase();

    for (const [type, keywords] of Object.entries(technicalKeywords)) {
      const foundKeywords = keywords.filter(keyword => lowerText.includes(keyword));
      
      if (foundKeywords.length > 0) {
        const keywordProducts = this.products.filter(p => 
          foundKeywords.some(keyword => 
            p.name.toLowerCase().includes(keyword) ||
            p.description.toLowerCase().includes(keyword)
          )
        );

        if (keywordProducts.length > 0) {
          matches.push({
            type: type,
            keywords: foundKeywords,
            products: keywordProducts.slice(0, 10)
          });
        }
      }
    }

    return matches;
  }

  /**
   * Process complete OCR text and return matched products
   * @param {string} ocrText - Raw OCR text
   * @returns {Object} - Complete processing results
   */
  async processOCRText(ocrText) {
    // Ensure products are loaded
    if (this.products.length === 0) {
      await this.initialize();
    }

    // Parse OCR text into items
    const parsedItems = this.parseOCRText(ocrText);
    
    // Match each item with products
    const processedItems = parsedItems.map(item => {
      const matches = this.findMatches(item.productText);
      
      // Determine best match and price
      let bestMatch = null;
      let price = 0;
      let confidence = matches.confidence;

      if (matches.exactMatch) {
        bestMatch = matches.exactMatch;
        price = bestMatch.price;
        confidence = 1.0;
      } else if (matches.fuzzyMatches.length > 0 && matches.fuzzyMatches[0].confidence > 0.7) {
        bestMatch = matches.fuzzyMatches[0].product;
        price = bestMatch.price;
        confidence = matches.fuzzyMatches[0].confidence;
      }

      return {
        ...item,
        bestMatch: bestMatch,
        price: price,
        confidence: confidence,
        allMatches: matches,
        requiresReview: confidence < 0.8 || !bestMatch,
        suggestions: this.generateSuggestions(matches)
      };
    });

    // Calculate statistics
    const stats = this.calculateStats(processedItems);

    return {
      success: true,
      originalText: ocrText,
      parsedItems: parsedItems.length,
      processedItems: processedItems,
      stats: stats,
      processedAt: new Date()
    };
  }

  /**
   * Generate suggestions for manual review
   * @param {Object} matches - All match results
   * @returns {Array} - Suggestions for user
   */
  generateSuggestions(matches) {
    const suggestions = [];

    if (matches.fuzzyMatches.length > 0) {
      suggestions.push({
        type: 'fuzzy_matches',
        message: `Found ${matches.fuzzyMatches.length} similar products`,
        options: matches.fuzzyMatches.slice(0, 3).map(m => ({
          product: m.product,
          confidence: m.confidence,
          reason: `${(m.confidence * 100).toFixed(1)}% match`
        }))
      });
    }

    if (matches.categoryMatches.length > 0) {
      suggestions.push({
        type: 'category_matches',
        message: `Found products in related categories`,
        options: matches.categoryMatches.map(cm => ({
          category: cm.category,
          productCount: cm.products.length,
          reason: `Matched keywords: ${cm.matchedKeywords.join(', ')}`
        }))
      });
    }

    if (matches.keywordMatches.length > 0) {
      suggestions.push({
        type: 'keyword_matches',
        message: `Found products with matching specifications`,
        options: matches.keywordMatches.map(km => ({
          type: km.type,
          keywords: km.keywords,
          productCount: km.products.length
        }))
      });
    }

    return suggestions;
  }

  /**
   * Calculate processing statistics
   * @param {Array} items - Processed items
   * @returns {Object} - Statistics
   */
  calculateStats(items) {
    const total = items.length;
    const exactMatches = items.filter(i => i.confidence === 1.0).length;
    const highConfidence = items.filter(i => i.confidence > 0.8).length;
    const withPrices = items.filter(i => i.price > 0).length;
    const requiresReview = items.filter(i => i.requiresReview).length;

    return {
      totalItems: total,
      exactMatches: exactMatches,
      highConfidenceMatches: highConfidence,
      itemsWithPrices: withPrices,
      itemsRequiringReview: requiresReview,
      averageConfidence: total > 0 ? (items.reduce((sum, i) => sum + i.confidence, 0) / total).toFixed(3) : 0,
      processingAccuracy: total > 0 ? ((highConfidence / total) * 100).toFixed(1) : 0
    };
  }
}

module.exports = SmartProductMatcher;
