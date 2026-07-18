import { transformFileSync } from "@babel/core";
import { writeFileSync } from "fs";

const result = transformFileSync("tui.tsx", {
  presets: [
    "@babel/preset-typescript",
    ["babel-preset-solid", { generate: "universal", moduleName: "@opentui/solid" }],
  ],
});

writeFileSync("tui.js", result.code);
console.log("tui.js compiled successfully");
