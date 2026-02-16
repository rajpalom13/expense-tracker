import { inngest } from '@/lib/inngest';
import { getMongoDb } from '@/lib/mongodb';
import type { AiInsightType } from '@/lib/ai-types';

const POST_PRICES_TYPES: AiInsightType[] = ['investment_insights'];

export const postPricesInsights = inngest.createFunction(
  { id: 'post-prices-insights', name: 'Generate Investment Insights After Price Refresh' },
  { event: 'finance/prices.updated' },
  async ({ step }) => {
    const userIds = await step.run('discover-investment-users', async () => {
      const db = await getMongoDb();
      const stockUsers: string[] = await db.collection('stocks').distinct('userId');
      const mfUsers: string[] = await db.collection('mutual_funds').distinct('userId');
      return Array.from(new Set([...stockUsers, ...mfUsers]));
    });

    if (userIds.length === 0) return { usersFound: 0 };

    const events = userIds.map((userId) => ({
      name: 'finance/insights.generate' as const,
      data: { userId, types: POST_PRICES_TYPES, trigger: 'post-prices' as const },
    }));

    await step.sendEvent('fan-out-post-prices', events);

    return { usersFound: userIds.length };
  }
);
