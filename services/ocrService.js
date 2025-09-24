const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Extract text from image using Google Gemini API
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} mimeType - Image MIME type
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const extractTextFromImage = async (imageBuffer, mimeType) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imageData = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType
      }
    };

    const prompt = `Extract all items and quantities from this image. Format the output as a JSON object with a 'products' array. Each object in the array should have fields for 'item_number', 'product_name', 'total_quantity', and an array named 'sub_quantities' for colors and their counts. If a product has no sub-quantities, the 'sub_quantities' array should be empty. Interpret any handwritten text and correct spelling based on context.

Example of expected output structure:
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
}`;

    const result = await model.generateContent([prompt, imageData]);
    const response = await result.response;
    const text = response.text();

    // Extract usage metadata
    const usageMetadata = {
      promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokenCount: response.usageMetadata?.totalTokenCount || 0
    };

    return {
      success: true,
      text: text,
      usageMetadata: usageMetadata
    };

  } catch (error) {
    console.error('Error in OCR service:', error);
    return {
      success: false,
      error: error.message,
      text: null,
      usageMetadata: null
    };
  }
};

/**
 * Parse JSON response from OCR
 * @param {string} textResponse - Raw text response from OCR
 * @returns {Object} - Parsed JSON data or null
 */
const parseOCRResponse = (textResponse) => {
  try {
    // Try to find JSON in the response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      const parsedData = JSON.parse(jsonStr);

      // Validate structure
      if (parsedData.products && Array.isArray(parsedData.products)) {
        return {
          success: true,
          data: parsedData,
          rawText: textResponse
        };
      }
    }

    return {
      success: false,
      error: 'Invalid JSON structure in OCR response',
      rawText: textResponse
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      rawText: textResponse
    };
  }
};

/**
 * Calculate cost estimate based on token usage
 * @param {Object} usageMetadata - Token usage metadata
 * @returns {Object} - Cost analysis
 */
const calculateCostEstimate = (usageMetadata) => {
  if (!usageMetadata) return null;

  // Gemini 2.0 Flash pricing (as of 2024)
  const inputPricePer1M = 0.075;  // $0.075 per 1M input tokens
  const outputPricePer1M = 0.30;  // $0.30 per 1M output tokens

  const promptTokens = usageMetadata.promptTokenCount || 0;
  const completionTokens = usageMetadata.candidatesTokenCount || 0;
  const totalTokens = usageMetadata.totalTokenCount || 0;

  const inputCost = (promptTokens / 1_000_000) * inputPricePer1M;
  const outputCost = (completionTokens / 1_000_000) * outputPricePer1M;
  const totalCost = inputCost + outputCost;

  return {
    input_tokens: promptTokens,
    output_tokens: completionTokens,
    total_tokens: totalTokens,
    input_cost_usd: inputCost,
    output_cost_usd: outputCost,
    total_cost_usd: totalCost
  };
};

module.exports = {
  extractTextFromImage,
  parseOCRResponse,
  calculateCostEstimate
};
