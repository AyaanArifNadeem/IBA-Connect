# Database connection and latency checklist

How to find out whether the database connection is part of a slow response, and the settings you can
change without touching code. Measure first: none of the settings below is a fix on its own.

## 1. Is the runtime URL the transaction pooler?

`DATABASE_URL` in Vercel must be the Supabase **transaction pooler** (port `6543`).
`DIRECT_URL` is for migrations only. In production the app logs a one-line warning at start-up
(`[db] DATABASE_URL points at a direct Supabase connection ...`) when it is not. The warning never
contains the user, password or host.

## 2. Are the function and the database in the same region?

- Supabase: **Project Settings → General** shows the region (the setup guide recommends Singapore or Mumbai).
- Vercel: **Project → Settings → Functions → Function Region**. The default is Washington DC (`iad1`).

A function in `iad1` talking to a database in Singapore pays one long round trip *per query*, and
a page that runs five queries one after the other pays it five times. If the regions differ, move the
function region next to the database (for example `sin1` or `bom1`; the choices depend on your Vercel
plan). This is deliberately not set in `vercel.json`: it depends on where your project actually is.

## 3. Cold start versus warm

Compare the first request after a quiet period with the next ones. A slow first request and fast
repeats point at a cold function and a cold connection pool (opening a TLS connection to a far-away
database takes several round trips). A slow request every time points at per-request work (queries,
Auth, Storage, email).

## 4. Pool settings (only after measuring)

Each server instance has its own pool, so `instances x pool size` must stay below the pooler's client
limit (small on the free tier). All of these are optional environment variables; without them the app
behaves as before.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_POOL_MAX` | pg default (10) | Connections per instance |
| `DATABASE_IDLE_TIMEOUT_MS` | pg default (10 000) | Close idle connections after this long |
| `DATABASE_CONNECT_TIMEOUT_MS` | 10 000 | Give up connecting after this long |
| `DATABASE_QUERY_TIMEOUT_MS` | 20 000 (0 = off) | Give up on one query after this long |

The 10 s connect timeout is a ceiling for failing instead of hanging, not a delay every request waits.
Do not raise the pool size to "go faster": a request that runs several queries together needs a few
connections, but more connections per instance mostly exhaust the pooler.

## 5. What to record

For each action you test (send a request, accept, send a chat message, open the directory),
repeat it 20 times cold and warm and write down the median and the 95th percentile of: the browser
time, the API response time (Vercel function logs) and, for the slow ones, the time of each query
(`EXPLAIN (ANALYZE, BUFFERS)` in the Supabase SQL editor). Compare before and after each change.
