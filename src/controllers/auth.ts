import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SignupRequest, LoginRequest } from '../types';
import prisma from '../config/db';
import { Role } from '@prisma/client';

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  googleId: string;
}

declare global {
  namespace Express {
    interface Request {
      googleUser?: GoogleUser;
      user?: {
        id: string;
        email: string;
        role: Role;
      };
    }
  }
}

export const signup = async (req: Request<{}, {}, SignupRequest>, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      },
    });

    res.status(201).json({
      message: 'User created successfully. Please login to continue.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password as string);

    if (!isValidPassword) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '10d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// src/controllers/auth.ts
export const googleLogin = async (req: Request, res: Response) => {
  try {
    if (!req.googleUser) {
      return res.status(401).json({ error: 'No Google user data' });
    }

    const { email, name, picture, googleId } = req.googleUser;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
          role: 'STUDENT' as Role
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

