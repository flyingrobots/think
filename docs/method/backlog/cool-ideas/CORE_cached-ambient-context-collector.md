# Cached ambient context collector for capture

Instead of shelling out to `git` inline on every capture, build a bounded ambient-context collector with caching, timeouts, and explicit stale/unknown states.

That would preserve recall receipts without making capture pay the full probe cost every time.
