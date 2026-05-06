import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mealsRoutes from './routes/meals';
import workoutsRoutes from './routes/workouts';
import machinesRoutes from './routes/machines';
import fitbitRoutes from './routes/fitbit';
import uploadRoutes from './routes/upload';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/meals', mealsRoutes);
app.use('/workouts', workoutsRoutes);
app.use('/machines', machinesRoutes);
app.use('/fitbit', fitbitRoutes);
app.use('/upload', uploadRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => {
  console.log(`aws_backend running on port ${PORT}`);
});

export default app;
