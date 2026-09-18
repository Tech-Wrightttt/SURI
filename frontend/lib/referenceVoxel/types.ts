export enum TileType {
  Grass = "grass",
  Sand = "sand",
  Road = "road",
  Border = "border",
  Void = "void",
}

export interface MapCell {
  type: TileType;
  walkable: boolean;
  variant: number;
  elevation: number;
}

export interface MapConfig {
  width: number;
  height: number;
  cells: MapCell[][];
}

export interface CheckpointDef {
  id: string;
  label: string;
  t: number;
}

export interface DecorationDef {
  id: string;
  x: number;
  z: number;
  kind: "tree" | "palm" | "bush" | "flower" | "rock" | "log";
  variant: number;
  rotation: number;
  scale?: number;
  heightScale?: number;
  canopyScale?: number;
  elevation?: number;
}
