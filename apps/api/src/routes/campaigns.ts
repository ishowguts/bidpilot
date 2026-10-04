import { Router } from 'express';
import { advanceCampaignSchema, campaignIdSchema, createCampaignSchema } from '@bidpilot/shared';
import type { Database } from '@bidpilot/db';
import { handle, parse } from '../middleware/errors.js';
import { advanceCampaign, createCampaign, getCampaign, listCampaigns } from '../services/campaigns.js';

export function campaignsRouter(db: Database): Router {
  const router = Router();

  router.post(
    '/campaigns',
    handle(async (req, res) => {
      res.status(201).json(await createCampaign(db, parse(createCampaignSchema, req.body)));
    }),
  );

  router.get(
    '/campaigns',
    handle(async (_req, res) => {
      res.json(await listCampaigns(db));
    }),
  );

  router.get(
    '/campaigns/:id',
    handle(async (req, res) => {
      res.json(await getCampaign(db, parse(campaignIdSchema, req.params.id)));
    }),
  );

  router.post(
    '/campaigns/:id/advance',
    handle(async (req, res) => {
      const id = parse(campaignIdSchema, req.params.id);
      const { days } = parse(advanceCampaignSchema, req.body);
      res.json(await advanceCampaign(db, id, days));
    }),
  );

  return router;
}
