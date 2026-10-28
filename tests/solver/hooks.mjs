// Node module-resolution hooks that let the Next.js route handler
// (frontend/app/api/solve/route.ts) run under the plain Node test runner:
//   * "next/server" has no ESM "exports" map, so point it at next/server.js.
//   * mathjs@3 is CommonJS without static named exports, so serve `parse`
//     through a small ESM shim that loads the real package with require().
const MATHJS_SHIM = new URL("./mathjs-shim.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  if (specifier === "mathjs" && !context.parentURL?.endsWith("mathjs-shim.mjs")) {
    return { url: MATHJS_SHIM, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
