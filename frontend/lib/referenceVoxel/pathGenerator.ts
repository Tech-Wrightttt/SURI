import * as THREE from "three";
import type { CheckpointDef } from "./types";

export type WorldCurve = THREE.Curve<THREE.Vector3>;
export const ROAD_CONTROL_POINTS = [
  new THREE.Vector3(-17, 0, -13), new THREE.Vector3(-7, 0, -13),
  new THREE.Vector3(-7, 0, -5), new THREE.Vector3(7, 0, -5),
  new THREE.Vector3(7, 0, 5), new THREE.Vector3(16, 0, 5),
  new THREE.Vector3(16, 0, 12), new THREE.Vector3(5, 0, 12),
  new THREE.Vector3(5, 0, 17), new THREE.Vector3(-9, 0, 17),
] as const;

class GridRouteCurve extends THREE.Curve<THREE.Vector3> {
  private readonly lengths: number[] = [0];
  private readonly totalLength: number;
  constructor(private readonly points: readonly THREE.Vector3[]) {
    super();
    let total = 0;
    for (let i = 1; i < points.length; i++) { total += points[i - 1].distanceTo(points[i]); this.lengths.push(total); }
    this.totalLength = total;
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const distance = THREE.MathUtils.clamp(t, 0, 1) * this.totalLength;
    let segment = 0;
    while (segment < this.lengths.length - 2 && distance > this.lengths[segment + 1]) segment++;
    const start = this.points[segment]; const end = this.points[segment + 1];
    const length = this.lengths[segment + 1] - this.lengths[segment];
    return target.copy(start).lerp(end, length > 0 ? (distance - this.lengths[segment]) / length : 0);
  }
  getTangent(t: number, target = new THREE.Vector3()) {
    const distance = THREE.MathUtils.clamp(t, 0, 1) * this.totalLength;
    let segment = 0;
    while (segment < this.lengths.length - 2 && distance >= this.lengths[segment + 1]) segment++;
    return target.copy(this.points[segment + 1]).sub(this.points[segment]).normalize();
  }
  getUtoTmapping(u: number) { return THREE.MathUtils.clamp(u, 0, 1); }
}

const ROUTE_LENGTHS = ROAD_CONTROL_POINTS.slice(1).map((point, index) => point.distanceTo(ROAD_CONTROL_POINTS[index]));
const TOTAL_ROUTE_LENGTH = ROUTE_LENGTHS.reduce((sum, value) => sum + value, 0);
const tAtPoint = (pointIndex: number) => ROUTE_LENGTHS.slice(0, pointIndex).reduce((sum, value) => sum + value, 0) / TOTAL_ROUTE_LENGTH;
export const CHECKPOINT_DEFS: CheckpointDef[] = [
  { id: "start", label: "Start", t: 0 }, { id: "cp1", label: "1", t: tAtPoint(2) },
  { id: "cp2", label: "2", t: tAtPoint(3) }, { id: "cp3", label: "3", t: tAtPoint(4) },
  { id: "cp4", label: "4", t: tAtPoint(6) }, { id: "cp5", label: "5", t: tAtPoint(7) },
  { id: "finish", label: "Finish", t: 1 },
];
export function createWorldPath() { return { mainCurve: new GridRouteCurve(ROAD_CONTROL_POINTS), checkpoints: CHECKPOINT_DEFS }; }
export function getPathPoint(curve: WorldCurve, t: number) { return curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1)); }
export function sampleCurvePoints(curve: WorldCurve, segments: number) { return Array.from({ length: segments + 1 }, (_, i) => curve.getPointAt(i / segments)); }
