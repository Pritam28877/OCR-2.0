const Quotation = require('../models/Quotation');

/**
 * Generate a unique quotation number
 * @returns {Promise<string>}
 */
const generateQuotationNumber = async () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Find the latest quotation for the current day to determine the sequence number
    const latestQuotation = await Quotation.findOne({
        quotationNumber: new RegExp(`^QT-${year}${month}${day}-`)
    }).sort({ quotationNumber: -1 });

    let sequence = 1;
    if (latestQuotation) {
        const lastSeq = parseInt(latestQuotation.quotationNumber.split('-').pop(), 10);
        sequence = lastSeq + 1;
    }

    const sequenceString = String(sequence).padStart(4, '0');
    return `QT-${year}${month}${day}-${sequenceString}`;
};

/**
 * Calculate all totals for a quotation
 * @param {Array} items - The list of items in the quotation
 * @returns {Object} - An object containing all calculated totals
 */
const calculateTotals = (items) => {
    let subtotal = 0;
    let totalDiscountAmount = 0;
    let totalGstAmount = 0;

    const processedItems = items.map(item => {
        const itemPrice = item.price * item.quantity;
        const discountAmount = itemPrice * (item.discountPercentage / 100);
        const netPrice = itemPrice - discountAmount;
        const taxAmount = netPrice * (item.gstPercentage / 100);
        const itemTotal = netPrice + taxAmount;

        subtotal += itemPrice;
        totalDiscountAmount += discountAmount;
        totalGstAmount += taxAmount;

        return {
            ...item,
            netPrice,
            taxAmount,
            itemTotal,
        };
    });

    const grandTotal = subtotal - totalDiscountAmount + totalGstAmount;

    return {
        processedItems,
        subtotal,
        totalDiscountAmount,
        totalGstAmount,
        grandTotal,
    };
};

module.exports = {
    generateQuotationNumber,
    calculateTotals,
};
