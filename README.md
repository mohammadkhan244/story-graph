# Story Map

Write a short story about the future, then see where it lands among everyone else's.

- **`/`**: the open prompt. Anyone can write. On submit, Claude places the story on the open prompt's two axes and the writer sees their dot (★ You) among everyone's. The map stays hidden until they submit, so it can't steer the story. A **Past sessions** tab lists every session map you've shared.
- **`/s/<id>`**: a session link you hand out. Writers write against the clock and then see only their own story. When you share the map, it appears on their screen (the page checks every 8 seconds).
- **`/?admin`**: password-protected. Create sessions, start or stop the timer, read stories as they arrive, have Claude propose axes, pick two, place everything, drag dots you disagree with, then share or hide the map.

Each session is mapped on its own axes. The 10/20/2026 Sensemakers session is seeded as the first past session. It's rebuilt from the spoken recaps in the transcript, labeled anonymously, and its placements were set by hand.

## Deploy (about 10 minutes)

1. **GitHub**: create an empty repo, then from this folder run:
   ```
   git remote add origin https://github.com/<you>/story-map.git
   git push -u origin main
   ```
2. **Vercel**: go to vercel.com/new, import the repo, and keep the defaults (it detects Next.js).
3. **Database**: in the Vercel project, open **Storage → Create → Neon (Postgres)** and connect it to the project. That sets `DATABASE_URL` for you. Tables and seed data are created on the first request.
4. **Environment variables** (Project → Settings → Environment Variables):
   - `ADMIN_PASSWORD`: your admin password
   - `ANTHROPIC_API_KEY`: from console.anthropic.com
   - `ANTHROPIC_MODEL` (optional): defaults to `claude-sonnet-5-5`
5. **Redeploy** so the variables take effect. Then open `/?admin`.

## Run locally

```
cp .env.example .env.local   # fill in DATABASE_URL, ADMIN_PASSWORD, ANTHROPIC_API_KEY
npm install
npm run dev
```
Set `MOCK_CLAUDE=1` to try every flow without an API key. Scores will be fake.

## Notes

- **Cost**: each story on `/` costs one small Claude call, and each "Find axes" or "Place all stories" costs one larger call.
- **Open link**: `/` takes public writes. There is a length limit and a honeypot, but no rate limit. If it gets abused, add Vercel's firewall rate limiting or close the open prompt.
- **Admin cookie**: stays valid for 30 days. Changing `ADMIN_PASSWORD` signs everyone out.
