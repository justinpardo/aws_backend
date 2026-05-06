import { Router, Request, Response } from 'express';
import { firebaseAuth, AuthRequest } from '../middleware/firebaseAuth';
import {
  getMachines,
  addMachine,
  updateMachine,
  deleteMachine,
  MachineEntry,
} from '../db/machinesStore';

const router = Router();
router.use(firebaseAuth);

// GET /machines
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const machines = await getMachines(uid);
  res.json(machines);
});

// POST /machines
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const {
    id,
    name,
    type,
    defaultReps,
    defaultWeight,
    weightUnit,
    notes,
    createdAt,
  } = req.body as Record<string, unknown>;

  if (!id || !name || !type) {
    res.status(400).json({ error: 'id, name, and type are required' });
    return;
  }

  const entry: MachineEntry = {
    uid,
    id: id as string,
    name: name as string,
    type: type as string,
    defaultReps: defaultReps as number | undefined,
    defaultWeight: defaultWeight as number | undefined,
    weightUnit: weightUnit as 'lbs' | 'kgs' | undefined,
    notes: notes as string | undefined,
    createdAt: (createdAt as string) ?? new Date().toISOString(),
  };

  await addMachine(entry);
  res.status(201).json(entry);
});

// PUT /machines/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { id } = req.params;
  const { name, type, defaultReps, defaultWeight, weightUnit, notes } = req.body as Record<
    string,
    unknown
  >;

  if (!name || !type) {
    res.status(400).json({ error: 'name and type are required' });
    return;
  }

  try {
    const updated = await updateMachine(uid, id, {
      name: name as string,
      type: type as string,
      defaultReps: defaultReps as number | undefined,
      defaultWeight: defaultWeight as number | undefined,
      weightUnit: weightUnit as 'lbs' | 'kgs' | undefined,
      notes: notes as string | undefined,
    });

    if (!updated) {
      res.status(404).json({ error: 'machine not found' });
      return;
    }
    res.json(updated);
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e.name === 'ConditionalCheckFailedException') {
      res.status(404).json({ error: 'machine not found' });
      return;
    }
    throw err;
  }
});

// DELETE /machines/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { id } = req.params;
  await deleteMachine(uid, id);
  res.json({ success: true });
});

export default router;
