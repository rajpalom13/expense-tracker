import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { corsHeaders, handleOptions } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { valid, user } = verifyToken(token);
    if (!valid || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.userId,
            name: user.name,
            email: user.email,
            username: user.email,
          },
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return handleOptions();
}
