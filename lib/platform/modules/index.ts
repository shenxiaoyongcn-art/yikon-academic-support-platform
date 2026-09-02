import { tenderModule } from './tender';
import { researchModule } from './research';
import { aftersalesModule } from './aftersales';
import { eventsModule } from './events';
import { analyticsModule } from './analytics';
import { pgdReviewModule } from './pgd-review';
import { trainingModule } from './training';
import { pedigreeModule } from './pedigree';

export const moduleDefinitions = [
  tenderModule,
  researchModule,
  aftersalesModule,
  eventsModule,
  analyticsModule,
  pgdReviewModule,
  trainingModule,
  pedigreeModule,
] as const;

export * from './types';
