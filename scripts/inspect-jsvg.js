const fs = require("fs");
const j = JSON.parse(
  fs.readFileSync("C:/Users/shreyas bp/OneDrive/Desktop/RPL-3_Mech.jsvg", "utf8")
);
const ids = [...j.svg.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
console.log("id count", ids.length);
console.log("sample ids", ids.slice(0, 30));
console.log("rect keys sample", Object.keys(j.rects).slice(0, 10));
console.log("source", j.source?.slice?.(0, 100) || j.source);
