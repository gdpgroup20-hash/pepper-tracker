# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Deploy

Share a single project list with your team using Supabase + Vercel:

1. **Create a Supabase project** — sign up for free at [supabase.com](https://supabase.com)
2. **Run the schema SQL** — open the SQL Editor in your Supabase dashboard and run the contents of [`supabase/schema.sql`](./supabase/schema.sql)
3. **Copy your credentials** — go to Settings > API and copy the **Project URL** and **anon/public key**
4. **Deploy to Vercel** — import this repo and add these environment variables:
   - `VITE_SUPABASE_URL` — your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key
5. **Share the Vercel URL** with your team — everyone sees the same project list in real time

Without Supabase env vars, the app falls back to localStorage (single-user mode).
