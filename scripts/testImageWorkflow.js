const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Quotation = require('../models/Quotation');
const { processImageOCR } = require('../controllers/ocrController');
const { createQuotation } = require('../controllers/quotationController');

// --- Main Test Runner ---
const runImageTestWorkflow = async () => {
  let testUser;
  let createdQuotation;

  try {
    console.log('🚀 Starting end-to-end IMAGE workflow test...');
    await connectDB();

    // 1. Get test user
    console.log('\n🔧 1. Getting test user...');
    testUser = await User.findOne({ email: 'testuser@example.com' });
    if (!testUser) {
      throw new Error('Test user not found. Please run the standard workflow test first to create it.');
    }
    console.log('✅ Test user found.');

    // 2. Read the image file
    const imagePath = path.join(__dirname, '..', 'test_1.jpeg');
    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image not found at path: ${imagePath}`);
    }
    const imageBuffer = fs.readFileSync(imagePath);
    console.log('\n🖼️  2. Successfully read the test image.');

    // 3. Process Image OCR
    const ocrReq = {
      file: {
        buffer: imageBuffer,
        mimetype: 'image/jpeg',
      },
    };

    let ocrResultData;
    const ocrRes = {
        status: (code) => ({
            json: (data) => {
                if (data.success) {
                    console.log('\n✅ 3. OCR processing completed successfully!');
                    console.log('   - Raw Text:', JSON.stringify(data.data.rawText));
                    console.log('   - Matched Products:', data.data.matchingResult.matchedProducts.length);
                    console.log('   - Unmatched Products:', data.data.matchingResult.unmatchedProducts.length);
                    ocrResultData = data.data;
                } else {
                    throw new Error(`OCR processing failed: ${data.message}`);
                }
            }
        })
    };
    await processImageOCR(ocrReq, ocrRes);
    
    // 4. Prepare quotation from matched products
    const verifiedItems = ocrResultData.matchingResult.matchedProducts.map(p => ({
      product: p.matched._id.toString(),
      quantity: p.extracted.quantity || 1, // Default to 1 if quantity not parsed
    }));

    if (verifiedItems.length === 0) {
      console.log('\n⚠️  No products were matched from the image. Cannot create a quotation.');
      return;
    }
    console.log('\n👍 4. Preparing quotation with:', verifiedItems.length, 'matched items.');

    // 5. Create Quotation
    const quotationPayload = {
      customer: { name: 'Handwritten Note Customer', email: 'hw@test.com' },
      items: verifiedItems,
    };
    
    const createReq = { body: quotationPayload, user: testUser };
    const createRes = {
        status: (code) => ({
            json: (data) => {
                if (data.success) {
                    console.log('\n✅ 5. Quotation from image created successfully!');
                    console.log('   - Quotation Number:', data.data.quotationNumber);
                    console.log('   - Grand Total:', data.data.grandTotal);
                    createdQuotation = data.data;
                } else {
                    throw new Error(`Quotation creation failed: ${data.message}`);
                }
            }
        })
    };
    await createQuotation(createReq, createRes);

    console.log('\n🎉 End-to-end IMAGE workflow test completed successfully!');

  } catch (error) {
    console.error('\n❌ Image test workflow failed:', error.message);
  } finally {
    // 6. Cleanup
    if (createdQuotation) {
        await Quotation.findByIdAndDelete(createdQuotation._id);
        console.log('\n🗑️  Cleaned up created quotation.');
    }
    await mongoose.connection.close();
    console.log('🔒 Database connection closed.');
  }
};

runImageTestWorkflow();

