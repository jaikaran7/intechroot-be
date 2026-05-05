import 'dotenv/config';
import { validateEnv } from './src/config/env.js';

validateEnv();

const { default: app } = await import('./src/app.js');

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] InTech Root API running on port ${PORT} (${process.env.NODE_ENV})`);
  console.log(`[server] Local:   http://localhost:${PORT}`);
  console.log(`[server] Network: http://<your-mac-ip>:${PORT}`);
});
