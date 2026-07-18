# Poker Night

Real-time Texas Hold'em & PLO4 for playing with friends. Next.js frontend on Vercel,
Supabase for Postgres + Realtime, a single Deno edge function as the authoritative
game server.

## Architecture

```
Browser (Next.js client)
   │
   ├─ Supabase Realtime (postgres_changes on rooms/players, presence, broadcast)
   │   → live table state, "who's connected", emote reactions
   │
   └─ POST https://<project>.supabase.co/functions/v1/poker  { op, ...body }
       → the ONE edge function that owns all game logic (supabase/functions/poker/)
       → reads/writes Postgres with the service-role key (RLS is bypassed here by design;
         `rooms`/`players` have public-read RLS policies for the client's direct reads)
```

There are **no Next.js API routes** — every mutation (create room, join, act, pause,
kick, etc.) goes through the edge function via an `op` field in the POST body. The
client only ever reads Postgres directly (via the anon key + RLS), never writes to
game-state tables directly.

### Why the engine exists in two copies

`src/lib/engine.ts` (+ `cards.ts`, `types.ts`) is imported by the Next.js client (for
things like the hand-strength hint) and by the checked-in fuzz test. The **live** copy
that actually runs the game is `supabase/functions/poker/engine.ts`, deployed as part of
the edge function — Deno needs explicit `.ts` extensions on relative imports, so it
can't literally `import` the same file as the Next.js side.

**After editing `src/lib/engine.ts`, `cards.ts`, or `types.ts`:**

```bash
npm run test:engine     # run the chip-conservation fuzz suite against your change first
npm run sync:engine     # copies + rewrites imports into supabase/functions/poker/
git diff supabase/functions/poker  # review the sync
```

Then redeploy the edge function (all 5 files: `index.ts`, `db.ts`, `engine.ts`,
`cards.ts`, `types.ts`) via the Supabase MCP tool or `supabase functions deploy poker`.

### The chip-conservation invariant

The engine has one true invariant that must hold after every single action:
`sum(player.chips) + room.pot` never changes except at the instant chips move into or
out of the pot. `src/lib/__tests__/engine.fuzz.test.ts` plays hundreds of randomized
hands across NLHE/PLO4, straddle, ante, and run-it-twice combinations and asserts this.
This is exactly how a real production bug (chips vanishing after certain PLO4 all-in +
fold sequences) was found — **run `npm run test:engine` before merging any change to
`engine.ts`.**

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:engine  # engine fuzz suite
npm run build        # production build + typecheck
```

Supabase URL/anon key are hardcoded fallbacks in `src/lib/supabaseClient.ts` and
`src/lib/api.ts` (they're public, client-safe values by design) so the app runs without
any `.env.local` setup. Override with `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_POKER_FN_URL` if pointing at a different
Supabase project.

## Deployment

- **Vercel**: connected to this repo's Git integration — every push to the tracked
  branch auto-deploys, no manual step.
- **Supabase edge function**: manual deploy (see sync instructions above), not wired to
  CI yet.
- **Admin visibility**: the `admin_rooms` op lists all active rooms and is gated by an
  `ADMIN_KEY` secret (`supabase secrets set ADMIN_KEY=...`) — unset by default, so it's
  closed until you explicitly configure it.

## Known gaps / deliberately deferred

These came up during a "100 upgrades" backlog pass and were intentionally **not**
implemented because they need external accounts/infrastructure this repo doesn't have,
or would need a real design discussion before writing code:

- Staging environment (separate Supabase + Vercel projects)
- CI (GitHub Actions) running `test:engine`/`build` on every push
- Error monitoring (Sentry or equivalent) — needs a DSN
- Load testing 50+ concurrent rooms against production
- Tournament structures (blind levels, SNG payouts, ICM), spectator mode, side-bets,
  deterministic hand replay via stored shuffle seeds
