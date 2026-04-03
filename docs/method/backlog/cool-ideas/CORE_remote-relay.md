# Remote relay and periodic pull

Design a distinct future lane for remote ingress rather than sneaking it into local ingress work.

Explore a small standalone relay package that can accept authenticated remote captures and write them into the upstream Git/WARP repo. Support periodic local pull or an explicit sync path so remote captures land back in the local primary repo cleanly.

Keep the remote relay brutally narrow:

- Accept exact raw thought text.
- Attach minimal explicit provenance.
- Write append-only into the upstream repo.
- Push refs upstream.

Treat auth, replay protection, idempotency, and rate limiting as first-class requirements rather than optional polish.

Preserve local-first reading and browsing; the relay should be a bridge, not the new product center.

Target eventual phone/on-the-go capture through the relay once the auth and sync model are honest.
