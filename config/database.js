const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.error('🔧 Please ensure MongoDB is running and the connection string is correct.');
    console.error('🔧 You can start MongoDB with: docker run -d -p 27017:27017 --name mongodb mongo:latest');
    console.error('🔧 Or install MongoDB locally and start the service.');
    throw error; // Throw instead of exit to allow graceful handling
  }
};

module.exports = connectDB;
