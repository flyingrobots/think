# Browse fade-in uses single color for all text

The splash-to-browse fade-in lerps all text from BG toward cream.
Section headers (amber), accents (teal), and dim text (mauve) all
appear as cream during the fade, then snap to their real colors when
bijou takes over. A proper fade would lerp each text element from BG
toward its actual target color.

Discovered during cycle 0004 transition work.
