import * as THREE from "three";

let installed = false;

/** Windows' HLSL compiler warns when PMREM subtracts a negligible sample term.
 * Three.js tracks this harmless driver diagnostic in issue #32692.
 * Keep shader compilation checks and all other diagnostics enabled.
 */
export function filterKnownPmremWarnings(log: string) {
  return log.split(/\r?\n/).filter(line => {
    const match = /warning X4122: sum of (1|0\.996094) and (-?\d+(?:\.\d+)?e-\d+) cannot be represented accurately in double precision\s*$/i.exec(line);
    return !match || Math.abs(Number(match[2])) > Number.EPSILON * Number(match[1]);
  }).join("\n");
}

export function installWorldShaderDiagnostics() {
  if (installed) return;
  installed = true;
  const previous = THREE.getConsoleFunction();
  THREE.setConsoleFunction((type, message, ...params) => {
    if (type === "warn" && message === "THREE.WebGLProgram: Program Info Log:" && typeof params[0] === "string") {
      const filtered = filterKnownPmremWarnings(params[0]);
      if (!filtered.trim()) return;
      params[0] = filtered;
    }
    if (previous) previous(type, message, ...params);
    else console[type](message, ...params);
  });
}
