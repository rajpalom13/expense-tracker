/**
 * GET /api/cron/status
 * Returns the latest run info for each cron job.
 * Requires user auth (for the dashboard page).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, corsHeaders, handleOptions } from '@/lib/middleware';
import { getMongoDb } from '@/lib/mongodb';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    try {
      const db = await getMongoDb();
      const col = db.collection('cron_runs');

      // Get latest run for each job type
      const jobs = ['prices', 'sync', 'analyze'];
      const status: Record<string, unknown> = {};

      for (const job of jobs) {
        const latest = await col
          .findOne({ job }, { sort: { finishedAt: -1 } });

        if (latest) {
          status[job] = {
            status: latest.status,
            results: latest.results || null,
            error: latest.error || null,
            startedAt: latest.startedAt,
            finishedAt: latest.finishedAt,
            durationMs: latest.durationMs || null,
          };
        } else {
          status[job] = { status: 'never_run' };
        }
      }

      // Also get recent history (last 10 runs)
      const recentRuns = await col
        .find({})
        .sort({ finishedAt: -1 })
        .limit(10)
        .toArray();

      const history = recentRuns.map((r) => ({
        job: r.job,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        durationMs: r.durationMs || null,
        error: r.error || null,
      }));

      return NextResponse.json(
        { success: true, status, history },
        { headers: corsHeaders() }
      );
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Failed to load cron status' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}
