import { createRequire } from "node:module";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const mathjs = require("mathjs");

export const parse = mathjs.parse;
export default mathjs;
