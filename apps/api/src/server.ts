import { createClient } from '@bidpilot/db';
import { parseEnv } from './env.js';
import { createApp } from './app.js';
import { createLlmClient } from './llm.js';

const env = parseEnv();
const app = createApp({
  env,
  db: createClient(env.DATABASE_URL),
  llm: createLlmClient(env.GEMINI_API_KEY, env.GEMINI_MODEL),
});

app.listen(env.PORT, () => {
  console.log(`api: listening on port ${env.PORT}`);
});
