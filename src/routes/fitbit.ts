import { Router, Request, Response } from 'express';
import axios from 'axios';
import { firebaseAuth, AuthRequest } from '../middleware/firebaseAuth';
import { saveFitbitTokens, getFitbitTokens } from '../db/fitbitStore';

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

    // Redirect back to the app with a success signal
    res.send('<html><body><h2>Fitbit connected! You can close this window.</h2></body></html>');
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

export default router;
