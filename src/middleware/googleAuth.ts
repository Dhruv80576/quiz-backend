import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';

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
    }
  }
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const googleUser: GoogleUser = {
      email: payload.email!,
      name: payload.name!,
      picture: payload.picture!,
      googleId: payload.sub!
    };

    req.googleUser = googleUser;
    next();
  } catch (error) {
    console.error('Google token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}; 