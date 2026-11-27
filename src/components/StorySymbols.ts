// Subjects that the story collection needs in addition to Lucide's standard set.
// Use the same 24-point grid and rounded strokes as the navigation symbols.
import { createLucideIcon } from "lucide-react";

export const Yurt = createLucideIcon("Yurt", [
  ["path", { d: "m2 11 8-6h4l8 6M4 11v8h16v-8M3 11h18M8 10l3-5m5 5-3-5M10 19v-4a2 2 0 0 1 4 0v4", key: "tent" }],
]);
export const Dombra = createLucideIcon("Dombra", [
  ["path", { d: "m11 13 7-10 2 1-7 11c2 4-1 7-5 6-4-1-6-5-3-8 1.6-2 4-2 6 0Z", key: "body" }],
  ["path", { d: "m8 17 3-4m5-9 2 1m1 2 2 1", key: "strings" }],
]);
export const Whale = createLucideIcon("Whale", [
  ["path", { d: "M3 13c0-3 3-5 7-5s6 3 7 5c2 0 4-2 5-4 1 7-4 11-11 11-5 0-8-3-8-7Z", key: "body" }],
  ["path", { d: "M8 6c0-2-2-3-3-3m3 3c1-2 2-3 3-3m-8 12c2 1 3 1 4 0", key: "spout" }],
  ["circle", { cx: "7", cy: "12", r: ".7", key: "eye" }],
]);
export const Bee = createLucideIcon("Bee", [
  ["path", { d: "M9 10C3 7 4 3 7 3c3 0 4 4 4 6 1-3 3-6 6-5 3 2 0 5-3 6", key: "wings" }],
  ["path", { d: "M4 14c0-3 3-5 7-5 5 0 8 2 8 6s-5 6-9 5c-3 0-6-2-6-6Zm4-4c1 3 1 6-1 9m6-9c1 3 1 6-1 10m7-5 3-1", key: "stripes" }],
]);
export const Dragon = createLucideIcon("Dragon", [
  ["path", { d: "m4 21 3-5-1-4 3-4-1-5 5 3 4-4-1 6 4 4 2 1-1 4-7-1-3 5", key: "profile" }],
  ["path", { d: "m5 11-3 2 3 1m1 2-3 2m12-7h.1m3 3h.1", key: "face" }],
]);
export const Bear = createLucideIcon("Bear", [
  ["path", { d: "M6 8C1 8 2 2 5.5 3c1.4 0 2.5 1 3 2a10 10 0 0 1 7 0c.5-1 1.7-2 3-2C22 2 23 8 18 8a8 8 0 1 1-12 0Z", key: "head" }],
  ["path", { d: "m9 11 .1 0m5.8 0 .1 0m-4 3h2l-1 1.5Z", key: "muzzle" }],
]);
export const Comet = createLucideIcon("Comet", [
  ["circle", { cx: "8", cy: "16", r: "4.5", key: "rock" }],
  ["path", { d: "m5 10 6-6m.5 5.5 8-8m-5 13 7-7m-5 10 4-4", key: "tail" }],
]);
