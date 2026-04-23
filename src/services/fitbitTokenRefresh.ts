import axios from 'axios';
import { getFitbitTokens, saveFitbitTokens } from '../db/fitbitStore';

const CLIENT_ID = process.env.FITBIT_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET ?? '';

interface FitbitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

/**
 * Refresh an expired Fitbit access token using the refresh token
 */
export async function refreshFitbitToken(uid: string) {
  const existing = await getFitbitTokens(uid);
  if (!existing) {
    throw new Error('No Fitbit tokens found for user');
  }

  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const response = await axios.post<FitbitTokenResponse>(
      'https://api.fitbit.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: existing.refreshToken,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const updated = {
      uid,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || existing.refreshToken,
      expiresAt: Date.now() + response.data.expires_in * 1000,
      fitbitUserId: existing.fitbitUserId,
    };

    await saveFitbitTokens(updated);
    return updated;
  } catch (err) {
    console.error('Token refresh error', err);
    throw new Error('Failed to refresh Fitbit token');
  }
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidFitbitToken(uid: string): Promise<string> {
  let tokens = await getFitbitTokens(uid);
  if (!tokens) {
    throw new Error('Not connected to Fitbit');
  }

  if (Date.now() >= tokens.expiresAt) {
    console.log(`Token expired for user ${uid}, refreshing...`);
    tokens = await refreshFitbitToken(uid);
  }

  return tokens.accessToken;
}
