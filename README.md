# Finding Moto - Frontend

React frontend application for Finding Moto built with Vite.

## Features

- React 18
- React Router for navigation
- Context API for state management
- Axios for API calls
- JWT authentication
- Google OAuth login
- Multi-role dashboard (buyer, seller, mechanic, admin)
- Role-based route protection
- Responsive design

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

The application will run on `http://localhost:5173`

## Project Structure

```
frontend/
├── public/          # Static files
├── src/
│   ├── assets/      # Images, fonts, etc.
│   ├── components/  # React components
│   │   ├── common/  # Reusable components
│   │   └── layout/  # Layout components
│   ├── context/     # React Context
│   ├── hooks/       # Custom hooks
│   ├── pages/       # Page components
│   ├── services/    # API services
│   ├── styles/      # CSS files
│   ├── App.tsx      # Main App component
│   └── main.tsx     # Entry point
├── .env
├── package.json
└── vite.config.ts
```

## Available Pages

- `/` - Home
- `/login` - Login
- `/register` - Multi-step registration
- `/dashboard` - Role-specific dashboard (Protected)
- `/products` - Products
- `/services` - Services
- `/about` - About
- `/contact` - Contact

## Technologies

- React 18
- Vite
- React Router DOM
- Axios
- Context API

## License

ISC
