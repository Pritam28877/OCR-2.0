const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class ImagePreprocessor {
  constructor() {
    this.defaultOptions = {
      // Image dimensions
      maxWidth: 2048,
      maxHeight: 2048,
      
      // Enhancement settings
      brightness: 1.1,      // Slightly brighter
      contrast: 1.3,        // Higher contrast for text
      saturation: 0.8,      // Reduce saturation to focus on text
      
      // Sharpening
      sharpen: {
        sigma: 1.5,         // Sharpening intensity
        flat: 1.0,          // Flat area preservation
        jagged: 2.0         // Jagged area enhancement
      },
      
      // Noise reduction
      denoise: 3,           // Noise reduction level (1-100)
      
      // Output format
      format: 'jpeg',
      quality: 95,
      
      // Text enhancement
      textEnhancement: true,
      edgeEnhancement: true
    };
  }

  /**
   * Preprocess image for better OCR text recognition
   * @param {string} inputPath - Path to input image
   * @param {string} outputPath - Path for processed image
   * @param {Object} options - Processing options
   * @returns {Object} - Processing results and metadata
   */
  async preprocessForOCR(inputPath, outputPath, options = {}) {
    try {
      const opts = { ...this.defaultOptions, ...options };
      
      console.log(`🖼️  Preprocessing image: ${path.basename(inputPath)}`);
      
      // Get original image metadata
      const originalMetadata = await sharp(inputPath).metadata();
      console.log(`📊 Original: ${originalMetadata.width}x${originalMetadata.height}, ${originalMetadata.format}, ${Math.round(originalMetadata.size / 1024)}KB`);

      // Start processing pipeline
      let pipeline = sharp(inputPath);

      // 1. Resize if image is too large (maintains aspect ratio)
      if (originalMetadata.width > opts.maxWidth || originalMetadata.height > opts.maxHeight) {
        pipeline = pipeline.resize(opts.maxWidth, opts.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
        console.log(`📏 Resizing to max ${opts.maxWidth}x${opts.maxHeight}`);
      }

      // 2. Convert to grayscale for better text recognition
      pipeline = pipeline.grayscale();
      console.log(`🎨 Converting to grayscale`);

      // 3. Enhance contrast and brightness for text clarity
      pipeline = pipeline.modulate({
        brightness: opts.brightness,
        saturation: opts.saturation
      });
      console.log(`✨ Enhancing brightness: ${opts.brightness}, saturation: ${opts.saturation}`);

      // 4. Apply linear contrast adjustment
      pipeline = pipeline.linear(opts.contrast, -(128 * opts.contrast) + 128);
      console.log(`🔆 Applying contrast: ${opts.contrast}`);

      // 5. Sharpen text for better edge definition
      if (opts.textEnhancement) {
        pipeline = pipeline.sharpen(opts.sharpen);
        console.log(`🔍 Sharpening with sigma: ${opts.sharpen.sigma}`);
      }

      // 6. Noise reduction
      if (opts.denoise > 0) {
        pipeline = pipeline.median(3); // Median filter for noise reduction
        console.log(`🧹 Applying noise reduction`);
      }

      // 7. Edge enhancement for text boundaries
      if (opts.edgeEnhancement) {
        // Apply unsharp mask for edge enhancement
        pipeline = pipeline.convolve({
          width: 3,
          height: 3,
          kernel: [
            -1, -1, -1,
            -1,  9, -1,
            -1, -1, -1
          ]
        });
        console.log(`📐 Enhancing edges for text clarity`);
      }

      // 8. Normalize histogram for consistent lighting
      pipeline = pipeline.normalize();
      console.log(`📊 Normalizing histogram`);

      // 9. Set output format and quality
      if (opts.format === 'jpeg') {
        pipeline = pipeline.jpeg({ 
          quality: opts.quality,
          progressive: false,
          mozjpeg: true // Better compression
        });
      } else if (opts.format === 'png') {
        pipeline = pipeline.png({ 
          quality: opts.quality,
          compressionLevel: 6
        });
      }

      // Execute the processing pipeline
      const processedBuffer = await pipeline.toBuffer();
      
      // Save processed image
      await fs.promises.writeFile(outputPath, processedBuffer);

      // Get processed image metadata
      const processedMetadata = await sharp(processedBuffer).metadata();
      
      const result = {
        success: true,
        inputPath: inputPath,
        outputPath: outputPath,
        original: {
          width: originalMetadata.width,
          height: originalMetadata.height,
          format: originalMetadata.format,
          size: originalMetadata.size,
          sizeKB: Math.round(originalMetadata.size / 1024)
        },
        processed: {
          width: processedMetadata.width,
          height: processedMetadata.height,
          format: processedMetadata.format,
          size: processedMetadata.size,
          sizeKB: Math.round(processedMetadata.size / 1024)
        },
        enhancement: {
          brightness: opts.brightness,
          contrast: opts.contrast,
          saturation: opts.saturation,
          sharpened: opts.textEnhancement,
          edgeEnhanced: opts.edgeEnhancement,
          denoised: opts.denoise > 0
        },
        processedAt: new Date().toISOString()
      };

      console.log(`✅ Processed: ${result.processed.width}x${result.processed.height}, ${result.processed.sizeKB}KB`);
      console.log(`📈 Size change: ${result.original.sizeKB}KB → ${result.processed.sizeKB}KB (${result.processed.sizeKB > result.original.sizeKB ? '+' : ''}${result.processed.sizeKB - result.original.sizeKB}KB)`);

      return result;

    } catch (error) {
      console.error('❌ Image preprocessing error:', error);
      throw new Error(`Image preprocessing failed: ${error.message}`);
    }
  }

  /**
   * Create multiple versions of image with different enhancement levels
   * @param {string} inputPath - Path to input image
   * @param {string} baseOutputPath - Base path for output files (without extension)
   * @returns {Array} - Array of processing results for different versions
   */
  async createEnhancedVersions(inputPath, baseOutputPath) {
    const versions = [
      {
        name: 'light',
        options: {
          brightness: 1.05,
          contrast: 1.1,
          saturation: 0.9,
          sharpen: { sigma: 1.0, flat: 1.0, jagged: 1.5 }
        }
      },
      {
        name: 'medium',
        options: {
          brightness: 1.1,
          contrast: 1.3,
          saturation: 0.8,
          sharpen: { sigma: 1.5, flat: 1.0, jagged: 2.0 }
        }
      },
      {
        name: 'strong',
        options: {
          brightness: 1.2,
          contrast: 1.5,
          saturation: 0.7,
          sharpen: { sigma: 2.0, flat: 1.0, jagged: 2.5 }
        }
      }
    ];

    const results = [];
    
    for (const version of versions) {
      const outputPath = `${baseOutputPath}_${version.name}.jpeg`;
      try {
        const result = await this.preprocessForOCR(inputPath, outputPath, version.options);
        result.version = version.name;
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to create ${version.name} version:`, error.message);
      }
    }

    return results;
  }

  /**
   * Analyze image quality for OCR suitability
   * @param {string} imagePath - Path to image
   * @returns {Object} - Quality analysis results
   */
  async analyzeImageQuality(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      const stats = await sharp(imagePath).stats();

      // Calculate quality metrics
      const resolution = metadata.width * metadata.height;
      const aspectRatio = metadata.width / metadata.height;
      
      // Analyze brightness and contrast from statistics
      const brightness = stats.channels[0].mean / 255; // Normalized brightness
      const contrast = stats.channels[0].stdev / 128;  // Normalized contrast
      
      // Quality scoring
      let qualityScore = 0;
      const factors = [];

      // Resolution scoring (higher is better, but too high wastes processing)
      if (resolution >= 1000000) { // 1MP+
        qualityScore += 30;
        factors.push('Good resolution');
      } else if (resolution >= 500000) { // 0.5MP+
        qualityScore += 20;
        factors.push('Adequate resolution');
      } else {
        qualityScore += 10;
        factors.push('Low resolution');
      }

      // Brightness scoring (0.3-0.7 is ideal)
      if (brightness >= 0.3 && brightness <= 0.7) {
        qualityScore += 25;
        factors.push('Good brightness');
      } else if (brightness >= 0.2 && brightness <= 0.8) {
        qualityScore += 15;
        factors.push('Acceptable brightness');
      } else {
        qualityScore += 5;
        factors.push(brightness < 0.3 ? 'Too dark' : 'Too bright');
      }

      // Contrast scoring (higher is better for text)
      if (contrast >= 0.4) {
        qualityScore += 25;
        factors.push('Good contrast');
      } else if (contrast >= 0.25) {
        qualityScore += 15;
        factors.push('Moderate contrast');
      } else {
        qualityScore += 5;
        factors.push('Low contrast');
      }

      // Aspect ratio scoring (reasonable ratios are better)
      if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
        qualityScore += 20;
        factors.push('Good aspect ratio');
      } else {
        qualityScore += 10;
        factors.push('Unusual aspect ratio');
      }

      // Determine overall quality
      let overallQuality;
      if (qualityScore >= 80) overallQuality = 'Excellent';
      else if (qualityScore >= 60) overallQuality = 'Good';
      else if (qualityScore >= 40) overallQuality = 'Fair';
      else overallQuality = 'Poor';

      return {
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: metadata.size,
          channels: metadata.channels
        },
        quality: {
          score: qualityScore,
          maxScore: 100,
          rating: overallQuality,
          factors: factors
        },
        metrics: {
          resolution: resolution,
          aspectRatio: Math.round(aspectRatio * 100) / 100,
          brightness: Math.round(brightness * 100) / 100,
          contrast: Math.round(contrast * 100) / 100
        },
        recommendations: this.generateRecommendations(qualityScore, brightness, contrast, resolution)
      };

    } catch (error) {
      throw new Error(`Image quality analysis failed: ${error.message}`);
    }
  }

  /**
   * Generate processing recommendations based on image analysis
   * @param {number} qualityScore - Overall quality score
   * @param {number} brightness - Brightness level (0-1)
   * @param {number} contrast - Contrast level (0-1)
   * @param {number} resolution - Image resolution
   * @returns {Array} - Array of recommendations
   */
  generateRecommendations(qualityScore, brightness, contrast, resolution) {
    const recommendations = [];

    if (qualityScore < 60) {
      recommendations.push('Consider using strong enhancement settings');
    }

    if (brightness < 0.3) {
      recommendations.push('Image is too dark - increase brightness enhancement');
    } else if (brightness > 0.7) {
      recommendations.push('Image is too bright - reduce brightness or increase contrast');
    }

    if (contrast < 0.25) {
      recommendations.push('Low contrast detected - use high contrast enhancement');
    }

    if (resolution < 500000) {
      recommendations.push('Low resolution - consider using a higher quality image');
    } else if (resolution > 4000000) {
      recommendations.push('Very high resolution - processing may be slower');
    }

    if (recommendations.length === 0) {
      recommendations.push('Image quality is good for OCR processing');
    }

    return recommendations;
  }
}

module.exports = ImagePreprocessor;
