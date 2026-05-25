import app from './app';
import { config } from './config';
import { startCronJobs } from './services/cron.service';

app.listen(config.port, () => {
  console.log(`[Tracix API] Server running on http://localhost:${config.port}`);
  console.log(`[Tracix API] Environment: ${config.nodeEnv}`);
  console.log(`[Tracix API] Frontend allowed: ${config.frontendUrl}`);
  startCronJobs();
});

export default app;
