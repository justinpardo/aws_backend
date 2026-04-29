import { Router, Request, Response } from 'express';
import axios from 'axios';
import { firebaseAuth, AuthRequest } from '../middleware/firebaseAuth';
import { saveFitbitTokens, getFitbitTokens } from '../db/fitbitStore';
import { addWorkout } from '../db/workoutsStore';
import { addMeal } from '../db/mealsStore';
import { getFitbitActivities, getFitbitMeals } from '../services/fitbitApiClient';

const router = Router();

const CLIENT_ID = process.env.FITBIT_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET ?? '';
const REDIRECT_URI = process.env.FITBIT_REDIRECT_URI ?? 'http://localhost:3002/fitbit/callback';

// GET /fitbit/status — check if the user has connected Fitbit (requires auth)
router.get('/status', firebaseAuth, async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const tokens = await getFitbitTokens(uid);
  res.json({ connected: !!tokens, fitbitUserId: tokens?.fitbitUserId ?? null });
});

// POST /fitbit/connect — Exchange authorization code for Fitbit tokens (mobile app)
router.post('/connect', firebaseAuth, async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { code, redirectUri } = req.body as Record<string, unknown>;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing or invalid code' });
    return;
  }

  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await axios.post<FitbitTokenResponse>(
      'https://api.fitbit.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: (redirectUri as string) || (REDIRECT_URI as string),
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in, user_id } = tokenResponse.data;
    await saveFitbitTokens({
      uid,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      fitbitUserId: user_id,
    });

    res.status(200).json({ success: true, message: 'Fitbit connected successfully' });
  } catch (err) {
    console.error('Fitbit connect error', err);
    res.status(500).json({ error: 'Failed to exchange Fitbit token' });
  }
});

// GET /fitbit/callback — OAuth callback from Fitbit (no Firebase auth — Fitbit calls this directly)
// The uid is passed as the state parameter from the mobile app
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state: uid } = req.query as Record<string, string>;

  if (!code || !uid) {
    res.status(400).send('Missing code or state');
    return;
  }

  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await axios.post<FitbitTokenResponse>(
      'https://api.fitbit.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in, user_id } = tokenResponse.data;
    await saveFitbitTokens({
      uid,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      fitbitUserId: user_id,
    });

    res.send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=epigenesisaiapp://fitbit-success"><script>window.location.href='epigenesisaiapp://fitbit-success';</script></head><body></body></html>`);
  } catch (err) {
    console.error('Fitbit callback error', err);
    res.status(500).send('Failed to exchange Fitbit token');
  }
});

interface FitbitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

// GET /fitbit/sync-workouts — Fetch and sync Fitbit activities to workouts table
router.get('/sync-workouts', firebaseAuth, async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { date } = req.query as { date?: string };
  const syncDate = date || new Date().toISOString().split('T')[0];

  try {
    const tokens = await getFitbitTokens(uid);
    if (!tokens) {
      res.status(400).json({ error: 'Not connected to Fitbit' });
      return;
    }

    const activities = await getFitbitActivities(uid, syncDate);

    if (activities.length === 0) {
      res.json({ success: true, message: 'No activities found for this date', workoutEntries: [] });
      return;
    }

    // Create individual entries for each activity
    const workoutEntries = [];
    for (const activity of activities) {
      // Parse startTime (format: HH:MM:SS) and combine with syncDate
      const activityDateTime = new Date(`${syncDate}T${activity.startTime}`).toISOString();
      
      const workoutEntry = {
        uid,
        loggedAt: activityDateTime,
        name: activity.activityName,
        exercises: [
          {
            name: activity.activityName,
            sets: 1,
            reps: 1,
            durationSeconds: Math.round(activity.duration / 1000),
          },
        ],
        notes: `Auto-synced from Fitbit. Calories burned: ${activity.calories}${activity.steps ? `, Steps: ${activity.steps}` : ''}`,
      };

      await addWorkout(workoutEntry);
      workoutEntries.push(workoutEntry);
    }

    res.json({
      success: true,
      message: `Successfully synced ${workoutEntries.length} workout${workoutEntries.length !== 1 ? 's' : ''}`,
      workoutEntries,
    });
  } catch (err: any) {
    console.error('Sync workouts error', err);
    const errorMsg = err.message || 'Failed to sync workouts';
    res.status(500).json({ error: errorMsg });
  }
});

// GET /fitbit/sync-meals — Fetch and sync Fitbit nutrition to meals table
router.get('/sync-meals', firebaseAuth, async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthRequest;
  const { date } = req.query as { date?: string };
  const syncDate = date || new Date().toISOString().split('T')[0];

  try {
    const tokens = await getFitbitTokens(uid);
    if (!tokens) {
      res.status(400).json({ error: 'Not connected to Fitbit' });
      return;
    }

    const nutrition = await getFitbitMeals(uid, syncDate);

    if (nutrition.calories === 0 && nutrition.foods.length === 0) {
      res.json({ success: true, message: 'No meals found for this date', mealEntries: [] });
      return;
    }

    // Group foods into meal entries (Breakfast, Lunch, Dinner)
    const mealEntries = [];
    const foods = nutrition.foods;

    if (foods.length === 0) {
      res.json({ success: true, message: 'No meals found for this date', mealEntries: [] });
      return;
    }

    // Distribute foods into meals: Breakfast, Lunch, Dinner (and Snacks if needed)
    const breakfastEnd = Math.ceil(foods.length / 3);
    const lunchEnd = Math.ceil((2 * foods.length) / 3);

    const mealGroups = [
      { name: 'Breakfast', foods: foods.slice(0, breakfastEnd) },
      { name: 'Lunch', foods: foods.slice(breakfastEnd, lunchEnd) },
      { name: 'Dinner', foods: foods.slice(lunchEnd) },
    ].filter((group) => group.foods.length > 0);

    // Create individual meal entries for each meal group
    for (const mealGroup of mealGroups) {
      const mealFoods = mealGroup.foods;
      const mealCalories = mealFoods.reduce((sum, f) => sum + f.calories, 0);

      // Estimate macros based on calorie distribution (rough approximation)
      const caloriePercentage = mealCalories / nutrition.calories || 0;
      const mealEntry = {
        uid,
        loggedAt: new Date().toISOString(),
        mealName: mealGroup.name,
        items: mealFoods.map((f) => f.name),
        calories: Math.round(mealCalories),
        protein: Math.round(nutrition.protein * caloriePercentage),
        carbs: Math.round(nutrition.carbs * caloriePercentage),
        fat: Math.round(nutrition.fat * caloriePercentage),
        notes: `Auto-synced from Fitbit on ${syncDate}. Foods: ${mealFoods.map((f) => f.name).join(', ')}`,
      };

      await addMeal(mealEntry);
      mealEntries.push(mealEntry);
    }

    res.json({
      success: true,
      message: `Successfully synced ${mealEntries.length} meal${mealEntries.length !== 1 ? 's' : ''}`,
      mealEntries,
    });
  } catch (err: any) {
    console.error('Sync meals error', err);
    const errorMsg = err.message || 'Failed to sync meals';
    res.status(500).json({ error: errorMsg });
  }
});

interface FitbitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

export default router;
