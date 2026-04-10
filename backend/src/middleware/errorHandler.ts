import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  errors?: { [key: string]: MongooseError.ValidatorError };
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error(err.stack);

  const error: CustomError = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error.message = message;
    error.statusCode = 404;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error.message = message;
    error.statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const message = Object.values(err.errors).map(val => val.message);
    error.message = message.join(', ');
    error.statusCode = 400;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error'
  });
};
