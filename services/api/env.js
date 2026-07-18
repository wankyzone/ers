import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the monorepo root .env. This must run before any module that reads
// process.env (e.g. ./supabase.js) is imported — hence a dedicated side-effect
// module imported first in index.js. In production (Render) no .env exists and
// platform-injected env vars are used; dotenv silently no-ops in that case.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
