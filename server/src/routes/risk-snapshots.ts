import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getRiskSnapshots } from '../services/snapshot.service';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const orgId = req.user!.organizationId;
  const days = Math.min(Number(req.query.days) || 90, 365);
  const snapshots = await getRiskSnapshots(orgId, days);
  res.json(snapshots);
});

export default router;
