import mongoose from 'mongoose';
import dns from 'node:dns';

// In development, configure public DNS resolvers (Google DNS) to reliably resolve MongoDB Atlas SRV records
// when local ISP/IPv6 resolvers fail on SRV lookups. Bypassed in production to use cloud provider DNS.
if (process.env.NODE_ENV !== 'production') {
  const customDns = process.env.DNS_SERVERS
    ? process.env.DNS_SERVERS.split(',').map((s) => s.trim())
    : ['8.8.8.8', '8.8.4.4'];
  try {
    dns.setServers(customDns);
  } catch (err) {
    console.warn(`[MongoDB] DNS configuration warning: ${err.message}`);
  }
}

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
