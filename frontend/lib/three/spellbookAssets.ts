import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const SPELLBOOK_PALETTES = [
  { leather: "#284764", shadow: "#152637", metal: "#d8b578", gem: "#66d6ff", ribbon: "#c07e3c" },
  { leather: "#563562", shadow: "#2b1839", metal: "#d7b77e", gem: "#c28aff", ribbon: "#b985cb" },
  { leather: "#36594e", shadow: "#192e29", metal: "#d5b77c", gem: "#73e7b2", ribbon: "#bca968" },
  { leather: "#713847", shadow: "#381b28", metal: "#d7af76", gem: "#ff94aa", ribbon: "#c68277" },
];

export const SPELLBOOK_SYMBOLS = ["≠", "√", "x²", "∏"];

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) | 0;
    return (value >>> 0) / 4294967296;
  };
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Spellbook textures require a 2D canvas.");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createLeatherTextures() {
  const leather = canvasTexture(512, 768, ctx => {
    const random = seededRandom(1729);
    const image = ctx.createImageData(512, 768);
    for (let y = 0; y < 768; y++) {
      for (let x = 0; x < 512; x++) {
        const offset = (y * 512 + x) * 4;
        const grain = 205 + random() * 28 + Math.sin(x * .12 + Math.sin(y * .08)) * 5;
        image.data[offset] = grain;
        image.data[offset + 1] = grain;
        image.data[offset + 2] = grain;
        image.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    for (let i = 0; i < 1300; i++) {
      const x = random() * 512;
      const y = random() * 768;
      ctx.strokeStyle = `rgba(42, 31, 24, ${.025 + random() * .07})`;
      ctx.lineWidth = .5 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 4, y - 4, x + random() * 14, y + 6, x + random() * 20, y + 12);
      ctx.stroke();
    }
    const vignette = ctx.createRadialGradient(256, 384, 110, 256, 384, 450);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(27,17,11,.28)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 512, 768);
  });
  const bump = leather.clone();
  bump.colorSpace = THREE.NoColorSpace;
  bump.needsUpdate = true;
  return { leather, bump };
}

export function createPageEdges() {
  return canvasTexture(256, 512, ctx => {
    const random = seededRandom(31415);
    ctx.fillStyle = "#d7bd86";
    ctx.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 512; y += 2 + random() * 3) {
      ctx.fillStyle = `rgba(91,61,31,${.1 + random() * .25})`;
      ctx.fillRect(0, y, 256, .6 + random());
      ctx.fillStyle = "rgba(255,247,210,.35)";
      ctx.fillRect(0, y + 1, 256, .5);
    }
    const edge = ctx.createLinearGradient(0, 0, 256, 0);
    edge.addColorStop(0, "rgba(75,41,16,.36)");
    edge.addColorStop(.18, "rgba(255,241,196,.1)");
    edge.addColorStop(.85, "rgba(255,241,196,.05)");
    edge.addColorStop(1, "rgba(75,41,16,.2)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, 256, 512);
  });
}

export function createGroundShadow() {
  return canvasTexture(128, 128, ctx => {
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, "rgba(22,11,7,.6)");
    gradient.addColorStop(.45, "rgba(22,11,7,.28)");
    gradient.addColorStop(1, "rgba(22,11,7,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  });
}

function mergeParts(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}

export function createSpineHardware() {
  const parts: THREE.BufferGeometry[] = [];
  for (const [index, y] of [-1.58, -1.04, -.53, 0, .53, 1.04, 1.58].entries()) {
    const band = new THREE.CylinderGeometry(.216, .216, index === 0 || index === 6 ? .13 : .065, 16);
    band.translate(-1.17, y, -.07);
    parts.push(band);
    const stud = new THREE.SphereGeometry(.04, 8, 6);
    stud.translate(-1.17, y, .147);
    parts.push(stud);
  }
  return mergeParts(parts);
}

export function createPageLayers() {
  const parts = [-.24, -.15, -.06, .03, .12].map((z, i) => {
    const geometry = new THREE.BoxGeometry(2.23, 3.16, .018);
    geometry.translate(.01 + i * .003, -.003 * i, z);
    return geometry;
  });
  return mergeParts(parts);
}

function wrappedText(ctx: CanvasRenderingContext2D, text: string, y: number, width: number, lineHeight: number) {
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      ctx.fillText(line, 256, y);
      y += lineHeight;
      line = word;
    } else line = next;
  }
  ctx.fillText(line, 256, y);
  return y;
}

export function createIlluminatedPage(label: string, ordinal: number, grade: number, insideCover = false) {
  return canvasTexture(768, 1152, ctx => {
    ctx.scale(1.5, 1.5);
    const random = seededRandom(ordinal * 997);
    ctx.fillStyle = "#f3e7c9";
    ctx.fillRect(0, 0, 512, 768);
    for (let i = 0; i < 7000; i++) {
      ctx.fillStyle = `rgba(105,69,30,${random() * .075})`;
      ctx.fillRect(random() * 512, random() * 768, 1 + random() * 3, 1);
    }
    const edge = ctx.createRadialGradient(256, 370, 120, 256, 370, 455);
    edge.addColorStop(0, "rgba(122,73,26,0)");
    edge.addColorStop(1, "rgba(122,73,26,.20)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, 512, 768);
    ctx.strokeStyle = "#aa803f";
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 29, 456, 710);
    ctx.lineWidth = 1;
    ctx.strokeRect(36, 37, 440, 694);
    for (const x of [46, 466]) for (const y of [47, 721]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#95682f";
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#644725";
    ctx.font = "bold 22px Georgia";
    ctx.fillText(insideCover ? "SURI'S SPELLBOOK ARCHIVE" : `VOLUME ${String(ordinal).padStart(2, "0")}`, 256, 92);
    ctx.fillStyle = "#2c1a15";
    ctx.font = "bold 46px Georgia";
    wrappedText(ctx, insideCover ? "The Art of Algebra" : label, 140, 390, 52);
    const cy = 411;
    ctx.strokeStyle = "#9c7948";
    for (const radius of [112, 120, 136]) {
      ctx.lineWidth = radius === 120 ? 2 : 1;
      ctx.beginPath();
      ctx.arc(256, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = i * Math.PI * 3 / 4 - Math.PI / 2;
      const x = 256 + Math.cos(a) * 106;
      const y = cy + Math.sin(a) * 106;
      if (!i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 125, cy + Math.sin(a) * 125);
      ctx.lineTo(256 + Math.cos(a) * 132, cy + Math.sin(a) * 132);
      ctx.stroke();
    }
    ctx.fillStyle = "#4e2f55";
    ctx.font = "bold 70px Georgia";
    ctx.fillText(insideCover ? "✦" : SPELLBOOK_SYMBOLS[(ordinal - 1) % 4], 256, cy + 18);
    ctx.font = insideCover ? "italic 29px Georgia" : "bold 34px Georgia";
    ctx.fillStyle = "#3c2921";
    ctx.fillText(insideCover ? "Every discovery begins" : ["ax + by = c", "xᵐ · xⁿ = xᵐ⁺ⁿ", "ax² + bx + c = 0", "P(x) = 0"][(ordinal - 1) % 4], 256, 603);
    ctx.font = "26px Georgia";
    ctx.fillText(insideCover ? "with a little curiosity." : "A new chapter awaits.", 256, 640);
    ctx.font = "bold 20px Georgia";
    ctx.fillText(insideCover ? "THE ACADEMY OF LEARNING" : `GRADE ${grade}  ·  SURI ACADEMY`, 256, 698);
  });
}

/** Raised brass ornament is real geometry, shared by every copy of a volume. */
export function createCoverMetalwork() {
  const parts: THREE.BufferGeometry[] = [];
  const addBox = (x: number, y: number, width: number, height: number, rotation = 0) => {
    const geometry = new THREE.BoxGeometry(width, height, .035);
    geometry.rotateZ(rotation);
    geometry.translate(x, y, .125);
    parts.push(geometry);
  };
  const line = (points: THREE.Vector3[], thickness = .014) => {
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(16, points.length * 5), thickness, 5, false));
  };
  for (const x of [-1.055, 1.055]) addBox(x, 0, .025, 2.94);
  for (const y of [-1.47, 1.47]) addBox(0, y, 2.13, .025);
  for (const x of [-.99, .99]) addBox(x, 0, .009, 2.80);
  for (const y of [-1.40, 1.40]) addBox(0, y, 1.98, .009);

  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    addBox(sx * 1.05, sy * 1.34, .13, .42);
    addBox(sx * .91, sy * 1.48, .40, .13);
    addBox(sx * .92, sy * 1.35, .15, .15, Math.PI / 4);
    const scroll = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24;
      const a = t * Math.PI * 2.2;
      const r = .18 * (1 - t) + .015;
      return new THREE.Vector3(sx * (.77 + Math.cos(a) * r), sy * (1.12 + Math.sin(a) * r), .146);
    });
    line(scroll, .012);
  }
  for (const radius of [.50, .58, .73]) {
    const ring = new THREE.TorusGeometry(radius, radius === .58 ? .029 : .013, 6, 72);
    ring.translate(0, .08, .15);
    parts.push(ring);
  }
  const points = Array.from({ length: 17 }, (_, i) => {
    const a = i * Math.PI / 8;
    const radius = i % 2 ? .36 : .64;
    return new THREE.Vector3(Math.sin(a) * radius, .08 + Math.cos(a) * radius, .16);
  });
  line(points, .018);
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12;
    addBox(Math.sin(a) * .665, .08 + Math.cos(a) * .665, .014, i % 3 ? .06 : .1, -a);
  }
  for (const sy of [-1, 1]) {
    const arc = Array.from({ length: 41 }, (_, i) => {
      const a = i / 40 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * .82, .08 + Math.sin(a) * .87 + sy * .035 * Math.sin(a * 6), .135);
    });
    line(arc, .011);
  }
  for (const x of [-1.05, 1.05]) for (const y of [-1.46, -.95, .95, 1.46]) {
    const rivet = new THREE.SphereGeometry(.036, 8, 6);
    rivet.scale(1, 1, .6);
    rivet.translate(x, y, .16);
    parts.push(rivet);
  }
  for (const y of [-.86, .86]) {
    addBox(1.205, y, .12, .31);
    const rivet = new THREE.SphereGeometry(.033, 8, 6);
    rivet.translate(1.205, y, .166);
    parts.push(rivet);
  }
  return mergeParts(parts);
}

export function createBookmarkGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-.09, 0);
  shape.lineTo(.09, 0);
  shape.lineTo(.09, -.67);
  shape.lineTo(0, -.58);
  shape.lineTo(-.09, -.67);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** Gold-stamped serif lettering; kept separate from the illuminated page art. */
export function createCoverLettering(label: string, ordinal: number) {
  return canvasTexture(768, 1152, ctx => {
    ctx.scale(1.5, 1.5);
    ctx.fillStyle = "#f7e6bf";
    ctx.shadowColor = "#25170e";
    ctx.shadowBlur = 1.4;
    ctx.shadowOffsetY = 1.5;
    ctx.font = "bold 26px Georgia, serif";
    const volume = `VOLUME ${String(ordinal).padStart(2, "0")}`;
    const tracking = 3.3;
    const width = [...volume].reduce((total, letter) => total + ctx.measureText(letter).width, 0) + (volume.length - 1) * tracking;
    let x = 256 - width / 2;
    for (const letter of volume) {
      ctx.fillText(letter, x, 126);
      x += ctx.measureText(letter).width + tracking;
    }
    ctx.font = "bold 40px Georgia, serif";
    ctx.textAlign = "center";
    const lines: string[] = [];
    let line = "";
    for (const word of label.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > 376) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    const firstBaseline = 642 - (lines.length - 1) * 22;
    lines.forEach((text, index) => ctx.fillText(text, 256, firstBaseline + index * 44));
  });
}
