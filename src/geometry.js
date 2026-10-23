'use strict';
function selection(a, b, width, height) {
  const clamp = (v, max) => Math.max(0, Math.min(max, v));
  const x1 = clamp(a.x, width), y1 = clamp(a.y, height);
  const x2 = clamp(b.x, width), y2 = clamp(b.y, height);
  return { x: Math.min(x1,x2), y: Math.min(y1,y2), width: Math.abs(x2-x1), height: Math.abs(y2-y1) };
}
function presetSize(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 16384 && height <= 16384;
}
if (typeof module !== 'undefined') module.exports = {selection, presetSize};
