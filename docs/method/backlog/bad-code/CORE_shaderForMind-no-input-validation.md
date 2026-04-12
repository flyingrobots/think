# shaderForMind lacks input validation

`shaderForMind(name, shaderCount)` does not validate that
`shaderCount > 0`. If 0 or negative, `Math.abs(hash) % shaderCount`
produces `NaN` or `Infinity` silently.

File: `src/minds.js`
