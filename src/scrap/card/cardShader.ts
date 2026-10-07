// 2D simplex noise as used in Paper Shaders' shader-utils (Ashima Arts /
// Stefan Gustavson, MIT). Inlined because the package doesn't export it.
const simplexNoise = /* glsl */ `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

/**
 * One material, three states, one input.
 *
 *   u_stress 0.00 ─ liquid metal          (adapted from Paper's LiquidMetal)
 *            0.30 ─ breaks into halftone  (gooey dots, à la Paper's HalftoneDots)
 *            0.70 ─ tears into glitch     (row tearing, RGB split, scanlines)
 *
 * The halftone samples the metal at each dot's centre, so the dots are made
 * *of* the metal — when stress drains the cells shrink back to nothing and
 * the surface heals rather than cross-fading.
 *
 * Liquid-metal stripe profile and simplex noise: Paper Shaders
 * (https://github.com/paper-design/shaders), Apache-2.0.
 */
export const cardFragmentShader = /* glsl */ `#version 300 es
precision highp float;

// Shared with Paper's vertex shader, which declares them mediump —
// precisions must match across stages or the program won't link.
uniform mediump vec2 u_resolution;
uniform mediump float u_pixelRatio;

uniform float u_clock;
uniform float u_stress;
uniform float u_back;
uniform vec2 u_tilt;
uniform vec3 u_deep;
uniform vec3 u_light;
uniform vec3 u_accent;

out vec4 fragColor;

#define PI 3.14159265358979323846

${simplexNoise}

vec2 rotate(vec2 p, float a) {
  return mat2(cos(a), sin(a), -sin(a), cos(a)) * p;
}

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// ── Liquid metal ─────────────────────────────────────────────────────────────
// Paper's stripe profile: a bright thin strip, a dark thin strip, then a wide
// soft gradient. Sampled per channel at slightly different phases for the
// prismatic fringe.
float stripeProfile(float c1, float c2, float p, vec3 w, float blur, float bump) {
  float ch = mix(c2, c1, smoothstep(0., 2. * blur, p));
  float border = w[0];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, p));
  border = w[0] + .4 * (1. - bump) * w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2. * blur, p));
  border = w[0] + .5 * (1. - bump) * w[1];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, p));
  border = w[0] + w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2. * blur, p));
  float g = (p - w[0] - w[1]) / w[2];
  ch = mix(ch, mix(c1, c2, smoothstep(0., 1., g)), smoothstep(border, border + .5 * blur, p));
  return ch;
}

vec3 metal(vec2 uv, float prefilter) {
  float ratio = u_resolution.x / u_resolution.y;
  vec2 p = (uv - .5) * vec2(ratio, 1.);  // card units, height 1, y up
  if (u_back > .5) p += vec2(.37, -.11);
  vec2 view = vec2(u_tilt.x, -u_tilt.y);
  float t = u_clock * .07;

  // Liquid: a slow two-octave domain warp.
  float n1 = snoise(p * .85 + vec2(t, -.6 * t));
  float n2 = snoise(p * 2.1 + vec2(-1.3 * t, t) + 7.1);
  float warp = .34 * n1 + .1 * n2;

  // Rim bevel: within a few percent of the edge the reflection bends.
  vec2 rim = min(uv, 1. - uv) * vec2(ratio, 1.);
  float bevel = 1. - smoothstep(0., .055, min(rim.x, rim.y));

  // Reflection coordinate: a diagonal sweep that slides as the card turns.
  float d = dot(p, normalize(vec2(.92, -.42))) * 1.1 + warp;
  d += dot(view, vec2(1.15, .7));
  d += bevel * bevel * .45;

  // Paper's stripe profile — a bright thin strip, a dark thin strip, then a
  // long falloff — sampled per channel at slightly offset phases (prism).
  float cycle = 1.05;
  vec3 w = vec3(.055, .035, .91);
  float bump = .55;
  float disp = .007 + .014 * bevel;
  float sr = fract(d * cycle + disp);
  float sg = fract(d * cycle);
  float sb = fract(d * cycle - disp * 1.3);
  // Pixel path: antialias with screen derivatives. Halftone path: every pixel
  // in a cell must agree on that cell's colour, so blur by the cell size
  // instead (this also pre-filters thin stripes the dots would alias).
  float blur = .006;
  vec3 aa = prefilter > 0. ? vec3(prefilter) : vec3(fwidth(sr), fwidth(sg), fwidth(sb));
  vec3 ch = vec3(
    stripeProfile(1., 0., sr, w, blur + aa.r, bump),
    stripeProfile(1., 0., sg, w, blur + aa.g, bump),
    stripeProfile(1., 0., sb, w, blur + aa.b, bump)
  );
  // Keep the long falloff low so highlights read as lines, not floods.
  ch = pow(ch, vec3(6.));

  // Broad environment: brighter "sky" toward the top, shifting with the view.
  float sky = smoothstep(-.75, .9, p.y + .25 * p.x + .6 * view.y + .15 * n1);
  vec3 col = mix(u_deep, u_light, .08 + .22 * sky);
  col = mix(col, u_light, ch * .92);

  // Brushed grain along the length of the card.
  col *= 1. + .035 * snoise(vec2(p.x * 3., p.y * 210.));

  // Soft specular sheen that tracks the tilt.
  float sheen = exp(-pow(dot(p + view * .9, normalize(vec2(.9, .5))) * 2.4, 2.));
  col += u_light * sheen * .09;

  // Darken toward the rim, lift the very edge — a machined bevel.
  col *= 1. - .12 * bevel;
  col += u_light * .16 * (1. - smoothstep(0., .012, min(rim.x, rim.y)));
  return col;
}

// The surface before any damage: metal, plus the magnetic stripe on the back.
vec3 surface(vec2 uv, float prefilter) {
  vec3 col = metal(uv, prefilter);
  if (u_back > .5) {
    float band = smoothstep(.705, .71, uv.y) * (1. - smoothstep(.885, .89, uv.y));
    vec3 stripe = u_deep * .32 + .05 * smoothstep(.0, 1., uv.x + u_tilt.x * .4);
    col = mix(col, stripe, band * .94);
  }
  return col;
}

// ── Halftone ─────────────────────────────────────────────────────────────────
// Gooey metaball dots on a rotated grid. Each dot's colour and size come from
// the metal at the dot's centre. Returns colour; writes coverage for the glitch
// pass. Evaluated at up to three offsets (RGB split) from one set of samples.
const float GRID_ANGLE = .5236;

void halftoneCells(vec2 px, float cellPx, float h, out vec2 id, out vec3 cols[9], out float radii[9]) {
  // One cell, in stripe-phase units (the stripes run ~1 cycle per card height).
  float prefilter = cellPx / u_resolution.y * 1.2;
  vec2 gp = rotate(px, GRID_ANGLE) / cellPx;
  id = floor(gp);
  int k = 0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cid = id + vec2(float(i), float(j));
      vec2 centre = rotate((cid + .5) * cellPx, -GRID_ANGLE) / u_resolution;
      vec3 c = surface(clamp(centre, 0., 1.), prefilter);
      float lum = dot(c, vec3(.2126, .7152, .0722));
      // As stress climbs, some dots drop out entirely — the card crumbles.
      float drop = .3 * smoothstep(.75, 1., h);
      float alive = drop > 0. ? smoothstep(drop, drop + .06, hash21(cid + 7.31)) : 1.;
      // Radii stay under 1.5 cells so nothing outside the 3×3 neighbourhood
      // would have contributed — otherwise the field steps at cell borders.
      float rFull = 1.5;
      float rDot = .22 + 1.15 * lum;
      cols[k] = c;
      radii[k] = mix(rFull, rDot, h) * mix(1., alive, h);
      k++;
    }
  }
}

float halftoneField(vec2 px, float cellPx, vec2 id, float radii[9], vec3 cols[9], out vec3 col) {
  vec2 f = rotate(px, GRID_ANGLE) / cellPx - id;
  float field = 0.;
  vec3 acc = vec3(0.);
  int k = 0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      float d = length(f - vec2(float(i), float(j)) - .5);
      float b = 1. - smoothstep(0., max(radii[k], 1e-3), d);
      b *= b;
      field += b;
      acc += cols[k] * b;
      k++;
    }
  }
  col = acc / max(field, 1e-4);
  return field;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_back > .5) uv.x = 1. - uv.x;

  float stress = clamp(u_stress, 0., 1.);
  float h = smoothstep(.12, .62, stress);   // halftone amount
  float gli = smoothstep(.66, .98, stress); // glitch amount
  float gt = floor(u_clock * 15.);           // glitch frame clock

  // ── Glitch: displace before we sample anything ──
  if (gli > 0.) {
    float bands = mix(14., 42., hash21(vec2(gt, 3.1)));
    float row = floor(uv.y * bands);
    float tear = (hash21(vec2(row, gt)) - .5) * .32 * gli;
    tear *= step(1. - .55 * gli, hash21(vec2(row + 11., gt * 1.3)));
    uv.x += tear;
    // Occasional vertical sync slip.
    float slip = step(.86, hash21(vec2(gt, 9.7)));
    uv.y += slip * (hash21(vec2(gt, 1.7)) - .5) * .12 * gli;
    uv = fract(uv);
  }

  vec3 col;
  if (h <= 0.) {
    col = surface(uv, 0.);
  } else {
    vec2 px = uv * u_resolution;
    float cellPx = mix(1.6, 13., h) * u_pixelRatio;
    vec2 id;
    vec3 cols[9];
    float radii[9];
    halftoneCells(px, cellPx, h, id, cols, radii);

    vec3 ink = u_deep * .45;
    vec3 dotCol;
    float field = halftoneField(px, cellPx, id, radii, cols, dotCol);
    float aa = fwidth(field) + 1e-3;
    float cover = smoothstep(.5 - aa, .5 + aa, field);
    vec3 ht = mix(ink, dotCol, cover);

    if (gli > 0.) {
      // RGB split, re-using the same nine samples.
      float split = (.18 + .22 * hash21(vec2(gt, 5.))) * gli * cellPx;
      vec3 tmp;
      float fr = halftoneField(px + vec2(split, 0.), cellPx, id, radii, cols, tmp);
      float fb = halftoneField(px - vec2(split, 0.), cellPx, id, radii, cols, tmp);
      float cr = smoothstep(.5 - aa, .5 + aa, fr);
      float cb = smoothstep(.5 - aa, .5 + aa, fb);
      ht.r = mix(ink.r, dotCol.r, cr);
      ht.b = mix(ink.b, dotCol.b, cb);
    }

    // Below ~15% the cells are a pixel or two wide; blend from the clean metal.
    float clean = 1. - smoothstep(0., .18, h);
    col = clean > 0. ? mix(ht, surface(uv, 0.), clean) : ht;
  }

  if (gli > 0.) {
    vec2 px = gl_FragCoord.xy;
    // Corrupted blocks: some invert, some flood with the accent.
    vec2 blk = floor(uv * vec2(9., 5.));
    float rb = hash21(blk + gt * 1.37);
    if (rb > 1. - .07 * gli) col = vec3(1.) - col;
    else if (rb > 1. - .13 * gli) col = mix(col, u_accent, .82);
    // Scanlines, two CSS pixels apart.
    col *= 1. - .22 * gli * (.5 + .5 * cos(px.y * PI / u_pixelRatio));
    // Grain.
    col += (hash21(px + gt) - .5) * .14 * gli;
  }

  // Banding fix (Paper).
  col += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

  fragColor = vec4(col, 1.);
}
`;
