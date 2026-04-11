# Clean up splash dead code

`src/splash.js` still imports `parseAnsiToSurface` and defines
`renderSplashView()`, but neither is called. The splash was moved to
direct stdout rendering to work around RE-015 (bijou flexSurface
corrupting braille art). The workaround is now the permanent path.

Remove the dead imports and the unused `renderSplashView()` function.
