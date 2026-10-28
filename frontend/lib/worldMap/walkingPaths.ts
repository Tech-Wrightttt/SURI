import * as THREE from "three";
import { terrainHeight } from "./landscape";

/** Interpolate the actual terrain triangles, including the low-detail grid. */
export function terrainSurface(geometry: THREE.PlaneGeometry, x: number, z: number) {
  const { widthSegments: columns, heightSegments: rows } = geometry.parameters;
  const positions=geometry.attributes.position;
  const minX=positions.getX(0), minZ=positions.getZ(0);
  const maxX=positions.getX(columns), maxZ=positions.getZ(rows*(columns+1));
  const gx=(x-minX)/(maxX-minX)*columns, gz=(z-minZ)/(maxZ-minZ)*rows;
  if(gx<0||gz<0||gx>columns||gz>rows)return terrainHeight(x,z);
  const column=Math.min(columns-1,Math.floor(gx)),row=Math.min(rows-1,Math.floor(gz));
  const u=gx-column,v=gz-row,index=row*(columns+1)+column;
  const a=positions.getY(index),b=positions.getY(index+columns+1);
  const c=positions.getY(index+columns+2),d=positions.getY(index+1);
  return u+v<=1 ? a+(d-a)*u+(b-a)*v : c+(b-c)*(1-u)+(d-c)*(1-v);
}

/** Closely spaced cross-sections prevent wide ribbons cutting through slopes. */
export function walkingRibbon(points: THREE.Vector3[], halfWidth: (x:number,z:number)=>number, surface: (x:number,z:number)=>number) {
  const samples: THREE.Vector3[]=[points[0]];
  for(let i=1;i<points.length;i++){
    const steps=Math.max(1,Math.ceil(points[i-1].distanceTo(points[i])/0.25));
    for(let step=1;step<=steps;step++)samples.push(points[i-1].clone().lerp(points[i],step/steps));
  }
  const vertices:number[]=[],indices:number[]=[],colors:number[]=[];
  const color=new THREE.Color("#baae8e"),slices=6,stride=slices+1;
  samples.forEach((point,i)=>{
    const tangent=samples[Math.min(samples.length-1,i+1)].clone().sub(samples[Math.max(0,i-1)]);
    tangent.y=0;tangent.normalize();
    const width=halfWidth(point.x,point.z);
    for(let j=0;j<=slices;j++){
      const offset=(j/slices*2-1)*width;
      const x=point.x+tangent.z*offset,z=point.z-tangent.x*offset;
      vertices.push(x,surface(x,z),z);
      // Subtle packed-earth variation, continuous across overlapping junctions.
      const shade=0.98+0.025*Math.sin(x*1.7+z*2.3);
      colors.push(color.r*shade,color.g*shade,color.b*shade);
      if(i<samples.length-1&&j<slices){
        const n=i*stride+j;indices.push(n,n+stride,n+1,n+1,n+stride,n+stride+1);
      }
    }
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
