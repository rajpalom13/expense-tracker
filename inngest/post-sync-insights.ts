import { inngest } from '@/lib/inngest';
import type { AiInsightType } from '@/lib/ai-types';

const POST_SYNC_TYPES: AiInsightType[] = [
  'spending_analysis',
  'monthly_budget',
  'weekly_budget',
];

export const postSyncInsights = inngest.createFunction(
  { id: 'post-sync-insights', name: 'Generate Insights After Sync' },
  { event: 'finance/sync.completed' },
  async ({ event, step }) => {
    const { userIds } = event.data;

    if (userIds.length === 0) return { usersFound: 0 };

    const events = userIds.map((userId) => ({
      name: 'finance/insights.generate' as const,
      data: { userId, types: POST_SYNC_TYPES, trigger: 'post-sync' as const },
    }));

    await step.sendEvent('fan-out-post-sync', events);

    return { usersFound: userIds.length };
  }
);
