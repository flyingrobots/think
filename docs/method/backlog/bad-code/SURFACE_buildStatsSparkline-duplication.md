# buildStatsSparkline duplicates logic from formatStats

Both `formatStats()` and `buildStatsSparkline()` in `src/mcp/format.js`
do the same `buckets.map(b => b.count).reverse()` → `sparkline()`.
`formatStats` does it inline AND `buildStatsSparkline` is exported for
`read.js`. Either inline everywhere or have `formatStats` call the
shared function — don't do both.

File: `src/mcp/format.js`
