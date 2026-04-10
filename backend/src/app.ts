import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import config from './config';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './routes/authRoutes';
import sellerRoutes from './routes/sellerRoutes';
import mechanicRoutes from './routes/mechanicRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import adminRoutes from './routes/adminRoutes';
import reviewRoutes from './routes/reviewRoutes';
import publicRoutes from './routes/publicRoutes';
import chatRoutes from './routes/chatRoutes';
import aiRoutes from './routes/aiRoutes';

const app: Application = express();

// Middleware
app.use(cors({
  origin: [config.clientUrl, 'http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(compression({ threshold: 1024 }));

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

// Routes
app.use('/api/public', publicRoutes);       // Public — No auth required (products/mechanics browsing)
app.use('/api/auth', authRoutes);          // Raakul — User Management
app.use('/api/seller', sellerRoutes);      // Thulax — Seller Dashboard
app.use('/api/mechanic', mechanicRoutes);  // Thulax — Mechanic Dashboard
app.use('/api/products', productRoutes);   // Arun   — Product Management
app.use('/api/orders', orderRoutes);       // Saran  — Order Management
app.use('/api/admin', adminRoutes);        // Sujani — Admin Dashboard
app.use('/api/reviews', reviewRoutes);     // Sivaganga — Rating & Review
app.use('/api/chat', chatRoutes);          // Chat — Real-time messaging
app.use('/api/ai', aiRoutes);              // AI assistant — Gemini-powered

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Finding Moto API is running' });
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;
