declare module "mathsteps";

declare module "mathjs" {
  export function parse(expression: string): unknown;
}

declare namespace JSX {
  interface IntrinsicElements {
    "math-field": any;
  }
}
