/* Rebuilds the EVO Proptech mark as a vector: `node brand/gen-logo.js`
 *
 * Every number below was measured from brand/logo-source.jpg by sampling
 * pixel columns across the copper square (box 938x900 px at 54,176), not
 * estimated by eye. Units are percent of the square, so the mark is a
 * 100x100 viewBox.
 *
 * The four white gaps run edge to edge, peaking at the centre. Each gap
 * edge is fitted with a Catmull-Rom spline through the measured points,
 * mirrored for the right half. Gaps are cut with a mask rather than painted
 * white, so on a dark surface the cut shows the surface, as in the source.
 */
const fs = require('fs');
const path = require('path');

// x positions sampled (percent from the left edge, 50 = centre)
const XS = [0, 2, 6, 12, 20, 30, 40, 50];

// [top edge, bottom edge] of each white gap at each x in XS.
// x=0 is extrapolated from the x=2 and x=6 samples.
const GAPS = [
  [[55.7, 60.1], [53.0, 58.0], [47.7, 53.9], [39.8, 47.2], [30.2, 38.7], [19.6, 28.6], [12.8, 21.0], [10.9, 18.8]],
  [[67.9, 69.8], [65.7, 68.1], [61.4, 64.7], [54.9, 59.2], [46.4, 51.8], [36.4, 42.8], [27.7, 35.0], [24.8, 32.4]],
  [[77.5, 78.1], [75.8, 76.7], [72.4, 74.0], [66.9, 70.0], [59.7, 64.1], [50.8, 56.8], [42.2, 49.9], [38.8, 47.6]],
  [[83.4, 83.4], [82.7, 82.9], [80.8, 82.0], [77.0, 79.7], [71.7, 75.8], [64.4, 70.2], [57.2, 65.7], [54.0, 64.1]]
];

const CORNER_RADIUS = 17.1;

const f = n => +n.toFixed(2);

// Full left-to-right point list for one edge (index 0 = top, 1 = bottom).
function edge(gap, side) {
  const left = XS.map((x, i) => [x, gap[i][side]]);
  const right = left.slice(0, -1).reverse().map(([x, y]) => [100 - x, y]);
  return left.concat(right);
}

// Catmull-Rom through pts, emitted as cubic Bezier segments.
function spline(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

const cuts = GAPS.map(gap => {
  const top = edge(gap, 0);
  const bottom = edge(gap, 1).reverse();
  return `M${f(top[0][0])} ${f(top[0][1])}${spline(top)} L${f(bottom[0][0])} ${f(bottom[0][1])}${spline(bottom)} Z`;
}).join(' ');

/* Gradient stops measured along the same box: brightest just above the
 * first band, falling to rust in the bottom corners. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="EVO Proptech">
  <defs>
    <radialGradient id="evo-g" cx="52%" cy="22%" r="90%">
      <stop offset="0" stop-color="#F6C986"/>
      <stop offset=".2" stop-color="#F1AE68"/>
      <stop offset=".5" stop-color="#D2874D"/>
      <stop offset=".64" stop-color="#C17845"/>
      <stop offset=".79" stop-color="#AD613D"/>
      <stop offset=".95" stop-color="#93452E"/>
      <stop offset="1" stop-color="#8E4029"/>
    </radialGradient>
    <mask id="evo-m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect width="100" height="100" fill="#fff"/>
      <path fill="#000" d="${cuts}"/>
    </mask>
  </defs>
  <rect width="100" height="100" rx="${CORNER_RADIUS}" fill="url(#evo-g)" mask="url(#evo-m)"/>
</svg>
`;

const out = process.argv[2] || path.join(__dirname, '..', 'assets', 'logo.svg');
fs.writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
