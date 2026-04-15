import { Router, Request, Response } from 'express';
import { firebaseAuth, AuthRequest } from '../middleware/firebaseAuth';
import { getMeals, addMeal, deleteMeal } from '../db/mealsStore';

const router = Router();
router.use(firebaseAuth);

// GET /meals
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const meals = await getMeals(uid);
  res.json(meals);
});

// POST /meals
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { mealName, items, calories, protein, carbs, fat, notes } = req.body as Record<string, unknown>;

  if (!mealName || typeof calories !== 'number') {
    res.status(400).json({ error: 'mealName and calories are required' });
    return;
  }

  const entry = {
    uid,
    loggedAt: new Date().toISOString(),
    mealName: mealName as string,
    items: (items as string[]) ?? [],
    calories: calories as number,
    protein: (protein as number) ?? 0,
    carbs: (carbs as number) ?? 0,
    fat: (fat as number) ?? 0,
    notes: notes as string | undefined,
  };

  await addMeal(entry);
  res.status(201).json(entry);
});

// DELETE /meals/:loggedAt
router.delete('/:loggedAt', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { loggedAt } = req.params;
  await deleteMeal(uid, loggedAt);
  res.json({ success: true });
});

export default router;
