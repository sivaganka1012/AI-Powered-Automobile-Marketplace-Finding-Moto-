import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  mongoURI: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  nodeEnv: string;
  clientUrl: string;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  smtpUser: string;
  smtpPass: string;
  geminiApiKey: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/finding-moto',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  geminiApiKey: process.env.GEMINI_API_KEY || ''
};

export default config;
