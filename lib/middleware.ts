// Middleware for protecting API routes
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AuthUser } from './auth';

/**
 * Extract JWT token from request headers or cookies
 */
export function extractToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  const cookieToken = request.cookies.get('auth-token')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Middleware to verify authentication
 * Usage: Wrap your route handler with this function
 */
export function withAuth(
  handler: (request: NextRequest, context: { user: AuthUser }) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const token = extractToken(request);

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const verification = verifyToken(token);

    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Call the handler with authenticated context
    return handler(request, { user: verification.user });
  };
}

/**
 * CORS headers for API routes
 */
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export function handleOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

/**
 * Validate a MongoDB ObjectId string
 */
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Middleware for cron routes: validates CRON_SECRET header.
 * Vercel cron jobs send the secret via the Authorization header as "Bearer <secret>".
 * We also accept a custom "x-cron-secret" header for manual triggers.
 */
export function withCronAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, message: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-cron-secret');
    const provided = cronHeader || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (provided !== secret) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(request);
  };
}
