# Finding Moto - Backend API

Backend REST API for Finding Moto application built with Node.js, Express, and MongoDB.

## Features

- Multi-role user authentication (buyer, seller, mechanic, admin)
- Role-based registration with approval workflow
- JWT-based authorization
- Google OAuth login
- MongoDB database integration
- RESTful API architecture
- Error handling middleware
- Request validation
- Security best practices

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/finding-moto
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will run on `http://localhost:5000`

## API Endpoints

### Authentication (Public)
- `POST /api/auth/register` - Register new user (buyer/seller/mechanic)
- `POST /api/auth/login` - Login user
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/approval-status/:email` - Check approval status

### Authentication (Protected)
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile

### Admin Only
- `GET /api/auth/admin/pending` - Get pending approvals
- `PUT /api/auth/admin/approve/:userId` - Approve/reject user
- `GET /api/auth/admin/users` - Get all users
- `PUT /api/auth/admin/toggle-active/:userId` - Toggle user active status

### Health Check
- `GET /api/health` - Server health status

### AI Endpoints (Protected)
- `POST /api/ai/chat` - Existing AI assistant chat
- `POST /api/ai/gemini/chat` - Gemini-powered contextual chat with role policy

## Project Structure

```
backend/
├── src/
│   ├── config/      # Configuration files
│   ├── controllers/ # Route controllers
│   ├── middleware/  # Custom middleware
│   ├── models/      # Mongoose models
│   ├── routes/      # API routes
│   ├── utils/       # Utility functions
│   ├── app.ts       # Express app setup
│   └── server.ts    # Server entry point
├── scripts/         # Seed/backfill scripts
├── uploads/         # Uploaded files
└── dist/            # Compiled output
```

## Technologies

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT (jsonwebtoken)
- bcryptjs

## License

ISC
