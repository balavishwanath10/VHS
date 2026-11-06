import mongoose from 'mongoose';

/**
 * Connect to MongoDB database using Mongoose
 * Reads connection URI from process.env.MONGODB_URI
 * Handles connection success, failure, and disconnection events safely without leaking credentials
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri === 'your_mongodb_connection_string') {
    const errorMsg = 'MongoDB URI is not configured in environment variables (process.env.MONGODB_URI).';
    console.error(`[MongoDB] Connection Failed: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error(`[MongoDB] Runtime error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Connection disconnected.');
    });

    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection Failed: ${error.message}`);
    throw error;
  }
};

export default connectDB;
