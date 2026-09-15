import type { NextConfig } from "next";

const path = require("path");

/** @type {import("next").NextConfig} */
module.exports = {
  turbopack: {
    root: path.join(__dirname), // forces frontend/ itself as the root
  },
};