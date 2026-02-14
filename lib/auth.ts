// Authentication utilities
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { AuthResponse } from './types';

// Get credentials from environment variables — fail fast if missing in production
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

if (!AUTH_USERNAME || !AUTH_PASSWORD || !JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_USERNAME, AUTH_PASSWORD, and JWT_SECRET must be set in production');
  }
  console.warn('Warning: AUTH_USERNAME, AUTH_PASSWORD, or JWT_SECRET not set. Using development defaults.');
}

const EFFECTIVE_USERNAME = AUTH_USERNAME || 'admin';
const EFFECTIVE_PASSWORD = AUTH_PASSWORD || 'admin';
const EFFECTIVE_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-prod';
const JWT_EXPIRES_IN = '7d';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

/**
 * Authenticate user with username and password (environment variables)
 */
export async function authenticateUser(username: string, password: string): Promise<AuthResponse> {
  try {
    // Check username and password against environment variables
    if (username.toLowerCase() !== EFFECTIVE_USERNAME.toLowerCase() || password !== EFFECTIVE_PASSWORD) {
      return {
        success: false,
        message: 'Invalid credentials',
      };
    }

    // Create JWT token
    const token = jwt.sign(
      {
        userId: '1',
        email: EFFECTIVE_USERNAME,
        name: 'Om Rajpal',
      },
      EFFECTIVE_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      success: true,
      token,
      message: 'Authentication successful',
      user: {
        id: '1',
        name: 'Om Rajpal',
        email: EFFECTIVE_USERNAME,
      },
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      message: 'Authentication failed',
    };
  }
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): { valid: boolean; user?: AuthUser } {
  try {
    const decoded = jwt.verify(token, EFFECTIVE_SECRET) as AuthUser;
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Generate a new JWT token
 */
export function generateToken(userId: string, email: string, name: string): string {
  return jwt.sign({ userId, email, name }, EFFECTIVE_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Get the authenticated user from cookies (server-side)
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, EFFECTIVE_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}
