import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { syncTransactions } from '@/inngest/sync';
import { refreshPrices } from '@/inngest/prices';
import { scheduledInsights } from '@/inngest/scheduled-insights';
import { postSyncInsights } from '@/inngest/post-sync-insights';
import { postPricesInsights } from '@/inngest/post-prices-insights';
import { generateUserInsights } from '@/inngest/generate-insights';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncTransactions,
    refreshPrices,
    scheduledInsights,
    postSyncInsights,
    postPricesInsights,
    generateUserInsights,
  ],
});
