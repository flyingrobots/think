# Core entry and session concepts are still plain objects

`src/store/model.js` returns raw objects for entries and reflect sessions even though these are identity-bearing, meaning-heavy domain concepts.

That is direct SSJR debt. Construction does not establish much trust beyond "shape happened to be present."
