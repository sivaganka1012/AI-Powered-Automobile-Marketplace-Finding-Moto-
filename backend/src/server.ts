import { createServer } from 'http';
import app from './app';
import config from './config';
import connectDB from './utils/db';
import { setupSocket } from './utils/socket';

// Connect to database
connectDB();

const PORT = config.port;

const httpServer = createServer(app);

// Setup Socket.IO
setupSocket(httpServer);

const server = httpServer.listen(PORT, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
