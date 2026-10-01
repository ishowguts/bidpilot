import { parseEnv } from './env.js';
import { createApp } from './app.js';

const env = parseEnv();
const app = createApp(env);

app.listen(env.PORT, () => {
  console.log(`api: listening on port ${env.PORT}`);
});
