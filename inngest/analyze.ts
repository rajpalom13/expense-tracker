import { inngest } from '@/lib/inngest';
import { getMongoDb } from '@/lib/mongodb';
import { runAiPipeline } from '@/lib/ai-pipeline';

const CRON_COLLECTION = 'cron_runs';

export const weeklyAnalysis = inngest.createFunction(
  { id: 'weekly-analysis', name: 'Weekly AI Spending Analysis' },
  { cron: '0 9 * * 1' }, // Monday at 9:00 AM UTC
  async ({ step }) => {
    const startedAt = new Date();
    let usersProcessed = 0;
    let usersFailed = 0;

    await step.run('run-ai-analysis', async () => {
      const db = await getMongoDb();
      const userIds = await db.collection('transactions').distinct('userId');

      for (const userId of userIds) {
        try {
          await runAiPipeline(userId, 'spending_analysis', { force: true, includeSearch: false });
          await runAiPipeline(userId, 'tax_optimization', { force: true, includeSearch: false });
          usersProcessed++;
        } catch {
          usersFailed++;
        }
      }

      const finishedAt = new Date();
      await db.collection(CRON_COLLECTION).insertOne({
        job: 'analyze',
        status: 'success',
        results: { usersProcessed, usersFailed },
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      });
    });

    return { usersProcessed, usersFailed };
  }
);
