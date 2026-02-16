import { Inngest, EventSchemas } from 'inngest';
import type { AiInsightType } from './ai-types';

type Events = {
  'finance/sync.completed': {
    data: {
      userIds: string[];
      transactionCount: number;
    };
  };
  'finance/prices.updated': {
    data: {
      stocksUpdated: number;
      fundsUpdated: number;
    };
  };
  'finance/insights.generate': {
    data: {
      userId: string;
      types: AiInsightType[];
      trigger: 'scheduled' | 'post-sync' | 'post-prices' | 'manual';
    };
  };
};

export const inngest = new Inngest({
  id: 'finance-tracker',
  schemas: new EventSchemas().fromRecord<Events>(),
});
