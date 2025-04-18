import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  password: string;
  role: 'TEACHER' | 'STUDENT';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'TEACHER' | 'STUDENT';
  };
}

export interface SignupRequest {
  email: string;
  password: string;
  role: 'TEACHER' | 'STUDENT';
}

export interface LoginRequest {
  email: string;
  password: string;
} 