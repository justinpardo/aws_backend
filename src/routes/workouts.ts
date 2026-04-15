import { Router, Request, Response } from 'express';
import { firebaseAuth, AuthRequest } from '../middleware/firebaseAuth';
import { getWorkouts, addWorkout, deleteWorkout } from '../db/workoutsStore';

const router = Router();
router.use(firebaseAuth);

// GET /workouts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const workouts = await getWorkouts(uid);
  res.json(workouts);
});

// POST /workouts
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { name, exercises, notes } = req.body as Record<string, unknown>;

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const entry = {
    uid,
    loggedAt: new Date().toISOString(),
    name: name as string,
    exercises: (exercises as WorkoutEntry['exercises']) ?? [],
    notes: notes as string | undefined,
  };

  await addWorkout(entry);
  res.status(201).json(entry);
});

// DELETE /workouts/:loggedAt
router.delete('/:loggedAt', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { loggedAt } = req.params;
  await deleteWorkout(uid, loggedAt);
  res.json({ success: true });
});

import { WorkoutEntry } from '../db/workoutsStore';
export default router;
