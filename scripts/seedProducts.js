const mongoose = require('mongoose');
const Product = require('../models/Product');
const connectDB = require('../config/database');

const sampleProducts = [
    // Sample Product 1
    {
        catalogueId: 'HW-W-10SMM',
        name: '10 sq mm wire',
        description: 'High-quality 10 sq mm electrical wire, suitable for heavy-duty applications.',
        brand: 'WirePro',
        classification: ['Hardware', 'Electrical'],
        units: 'Roll',
        price: 2500.00,
        defaultDiscount: 5,
        hsnCode: '85444999',
        gstPercentage: 18,
        subQuantities: [
            { color: 'Red', quantity: '5' },
            { color: 'Yellow', quantity: '5' },
            { color: 'Blue', quantity: '5' },
            { color: 'Black', quantity: '5' }
        ],
        isActive: true,
    },
    // Sample Product 2
    {
        catalogueId: 'HW-W-6SMM',
        name: '6 sq mm wire',
        description: 'Versatile 6 sq mm electrical wire for residential and commercial use.',
        brand: 'WirePro',
        classification: ['Hardware', 'Electrical'],
        units: 'Roll',
        price: 1800.00,
        defaultDiscount: 5,
        hsnCode: '85444999',
        gstPercentage: 18,
        subQuantities: [
            { color: 'Green', quantity: '4' },
            { color: 'Red', quantity: '4' },
            { color: 'Black', quantity: '4' }
        ],
        isActive: true,
    },
    // Sample Product 3
    {
        catalogueId: 'HW-W-2.5SMM',
        name: '2.5 sq mm wire',
        description: 'Standard 2.5 sq mm electrical wire for light-duty wiring.',
        brand: 'ElecFlex',
        classification: ['Hardware', 'Electrical'],
        units: 'Roll',
        price: 1200.00,
        defaultDiscount: 3,
        hsnCode: '85444999',
        gstPercentage: 18,
        subQuantities: [
            { color: 'Red', quantity: '2' },
            { color: 'Black', quantity: '2' }
        ],
        isActive: true,
    },
    // Sample Product 4
    {
        catalogueId: 'IND-CON-T57290',
        name: 'Computer Monitor Output Socket - 1 Module - Quartz Gray',
        description: 'A 1-module computer monitor output socket in a sleek quartz gray finish.',
        brand: 'ConnectIt',
        classification: ['Industrial', 'Controls'],
        units: 'Piece',
        price: 484.00,
        defaultDiscount: 10,
        hsnCode: '85366990',
        gstPercentage: 12,
        isActive: true,
    },
    // Sample Product 5
    {
        catalogueId: 'IND-CON-T58090',
        name: 'Fitment for RJ-45 Computer Socket Shuttered - 1 Module - Quartz Gray',
        description: 'Shuttered fitment for an RJ-45 computer socket, 1 module, in quartz gray.',
        brand: 'ConnectIt',
        classification: ['Industrial', 'Controls'],
        units: 'Piece',
        price: 312.00,
        defaultDiscount: 10,
        hsnCode: '85367000',
        gstPercentage: 12,
        isActive: true,
    },
    // Sample Product 6
    {
        catalogueId: 'ELE-SW-T57980',
        name: 'Audio Port / Jack 3.5mm - 1 Module - Quartz Gray',
        description: 'A 1-module audio port/jack (3.5mm) in a stylish quartz gray.',
        brand: 'SoundWave',
        classification: ['Electrical', 'Switches'],
        units: 'Piece',
        price: 554.00,
        defaultDiscount: 8,
        hsnCode: '85366910',
        gstPercentage: 12,
        isActive: true,
    },
    // Sample Product 7
    {
        catalogueId: 'ELE-AUD-BTHP01',
        name: 'Wireless Bluetooth Headphone',
        description: 'High-fidelity wireless bluetooth headphones with noise cancellation.',
        brand: 'SoundWave',
        classification: ['Electronics', 'Audio'],
        units: 'Piece',
        price: 3500.00,
        defaultDiscount: 15,
        hsnCode: '85183000',
        gstPercentage: 18,
        isActive: true,
    },
    // Sample Product 8
    {
        catalogueId: 'APP-TS-CTN01',
        name: 'Cotton T-shirt',
        description: 'Comfortable 100% cotton t-shirt, available in various sizes.',
        brand: 'Wearables',
        classification: ['Apparel', 'Clothing'],
        units: 'Piece',
        price: 800.00,
        defaultDiscount: 20,
        hsnCode: '61091000',
        gstPercentage: 5,
        isActive: true,
    },
    // Sample Product 9
    {
        catalogueId: 'HW-MTL-SSTEEL01',
        name: 'Stainless Steel Sheet',
        description: 'Grade 304 stainless steel sheet, 1mm thickness.',
        brand: 'MetalWorks',
        classification: ['Hardware', 'Materials'],
        units: 'Sheet',
        price: 4500.00,
        defaultDiscount: 5,
        hsnCode: '72199090',
        gstPercentage: 18,
        isActive: true,
    }
];

const seedDB = async () => {
    try {
        await connectDB();
        await Product.deleteMany({});
        await Product.insertMany(sampleProducts);
        console.log('Database seeded successfully');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        mongoose.connection.close();
    }
};

seedDB();
