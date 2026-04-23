import axios from 'axios';
import { getValidFitbitToken } from './fitbitTokenRefresh';
import { getFitbitTokens } from '../db/fitbitStore';

const FITBIT_API_BASE = 'https://api.fitbit.com/1/user';

export interface FitbitActivity {
  activityId: number;
  activityName: string;
  duration: number;
  startTime: string;
  calories: number;
  steps?: number;
}

export interface FitbitNutrition {
  date: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  foods: Array<{ name: string; calories: number }>;
}

/**
 * Fetch activities from Fitbit API for a specific date
 */
export async function getFitbitActivities(uid: string, date: string): Promise<FitbitActivity[]> {
  const token = await getValidFitbitToken(uid);
  const tokens = await getFitbitTokens(uid);

  if (!tokens) {
    throw new Error('Not connected to Fitbit');
  }

  try {
    const response = await axios.get(
      `${FITBIT_API_BASE}/${tokens.fitbitUserId}/activities/date/${date}.json`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return (response.data.activities || []).map((activity: any) => ({
      activityId: activity.activityId,
      activityName: activity.name,
      duration: activity.duration,
      startTime: activity.startTime,
      calories: activity.calories,
      steps: activity.steps,
    }));
  } catch (err: any) {
    console.error('Fitbit activities fetch error', err.response?.data || err.message);
    if (err.response?.status === 404) {
      return [];
    }
    throw err;
  }
}

/**
 * Fetch nutrition/meals from Fitbit API for a specific date
 */
export async function getFitbitMeals(uid: string, date: string): Promise<FitbitNutrition> {
  const token = await getValidFitbitToken(uid);
  const tokens = await getFitbitTokens(uid);

  if (!tokens) {
    throw new Error('Not connected to Fitbit');
  }

  try {
    const response = await axios.get(
      `${FITBIT_API_BASE}/${tokens.fitbitUserId}/foods/log/date/${date}.json`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const foods = response.data.foods || [];
    const summary = response.data.summary || {};

    return {
      date,
      calories: summary.calories || 0,
      carbs: summary.carbs || 0,
      fat: summary.fat || 0,
      protein: summary.protein || 0,
      foods: foods.map((f: any) => ({ name: f.name, calories: f.calories })),
    };
  } catch (err: any) {
    console.error('Fitbit meals fetch error', err.response?.data || err.message);
    if (err.response?.status === 404) {
      return {
        date,
        calories: 0,
        carbs: 0,
        fat: 0,
        protein: 0,
        foods: [],
      };
    }
    throw err;
  }
}

/**
 * Fetch heart rate data from Fitbit API for a specific date
 */
export async function getFitbitHeartRate(uid: string, date: string): Promise<{ date: string; heartRateData: any[] }> {
  const token = await getValidFitbitToken(uid);
  const tokens = await getFitbitTokens(uid);

  if (!tokens) {
    throw new Error('Not connected to Fitbit');
  }

  try {
    const response = await axios.get(
      `${FITBIT_API_BASE}/${tokens.fitbitUserId}/activities/heart/date/${date}/1d/1min.json`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return {
      date,
      heartRateData: response.data['activities-heart-intraday']?.dataset || [],
    };
  } catch (err: any) {
    console.error('Fitbit heart rate fetch error', err.response?.data || err.message);
    if (err.response?.status === 404) {
      return { date, heartRateData: [] };
    }
    throw err;
  }
}
