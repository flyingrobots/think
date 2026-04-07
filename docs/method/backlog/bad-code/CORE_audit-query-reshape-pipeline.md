# Query layer repeatedly re-shapes the same entry data

`src/store/queries.js` keeps remapping entries into new anonymous shapes for recent, remember, browse, inspect, and stats callers.

That increases coupling and makes it harder to trust that all surfaces are talking about the same domain object.
