# Annotate existing thoughts

Attach a note to an existing thought without mutating the original.

```
think --annotate=<entryId> "this turned out to be wrong"
```

A new derived entry with `kind: 'annotation'` linked via an
`annotates` edge. Browse TUI shows annotations below the thought.
Press `a` in browse to annotate inline.

Same graph primitives as reflect — new node, new edge, original
stays immutable.
