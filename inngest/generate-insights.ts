import { inngest } from '@/lib/inngest';
import { getMongoDb } from '@/lib/mongodb';
import { runAiPipeline } from '@/lib/ai-pipeline';
import type { AiInsightType } from '@/lib/ai-types';

const CRON_COLLECTION = 'cron_runs';

export const generateUserInsights = inngest.createFunction(
  {
    id: 'generate-user-insights',
    name: 'Generate AI Insights for User',
    concurrency: [
      { limit: 3 },
      { limit: 1, key: 'event.data.userId' },
    ],
    retries: 2,
  },
  { event: 'finance/insights.generate' },
  async ({ event, step }) => {
    const { userId, types, trigger } = event.data;
    const startedAt = new Date();
    const results: Record<string, { status: string; error?: string }> = {};

    for (const type of types) {
      const stepResult = await step.run(`generate-${type}`, async () => {
        try {
          const includeSearch = type === 'investment_insights';
          await runAiPipeline(userId, type as AiInsightType, {
            force: true,
            includeSearch,
          });
          return { status: 'success' as const };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { status: 'failed' as const, error: message };
        }
      });
      results[type] = stepResult;
    }

    await step.run('log-generation', async () => {
      const db = await getMongoDb();
      const finishedAt = new Date();
      await db.collection(CRON_COLLECTION).insertOne({
        job: 'insights-generation',
        trigger,
        userId,
        status: 'success',
        results,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      });
    });

    return { userId, results };
  }
);
