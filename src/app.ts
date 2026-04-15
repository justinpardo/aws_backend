import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mealsRoutes from './routes/meals';
import workoutsRoutes from './routes/workouts';
import fitbitRoutes from './routes/fitbit';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/meals', mealsRoutes);
app.use('/workouts', workoutsRoutes);
app.use('/fitbit', fitbitRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => {
  console.log(`aws_backend running on port ${PORT}`);
});

export default app;
