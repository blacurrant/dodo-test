// Minimal quaternion helpers. Convention: [x, y, z, w], CSS coordinate space
// (x → right, y → down, z → toward the viewer). `mul(a, b)` applies b, then a.

export type Quat = [number, number, number, number];
export type Vec3 = [number, number, number];

export const identity = (): Quat => [0, 0, 0, 1];

export function mul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export const conj = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];

export function normalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function fromAxisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

/** Rotation vector (axis × angle) → quaternion. */
export function fromRotVec(v: Vec3): Quat {
  const angle = Math.hypot(v[0], v[1], v[2]);
  if (angle < 1e-9) return identity();
  return fromAxisAngle([v[0] / angle, v[1] / angle, v[2] / angle], angle);
}

/** Quaternion → rotation vector (axis × angle), always the short way round. */
export function toRotVec(q: Quat): Vec3 {
  const sign = q[3] < 0 ? -1 : 1;
  const x = q[0] * sign;
  const y = q[1] * sign;
  const z = q[2] * sign;
  const s = Math.hypot(x, y, z);
  if (s < 1e-9) return [0, 0, 0];
  const angle = 2 * Math.atan2(s, q[3] * sign);
  return [(x / s) * angle, (y / s) * angle, (z / s) * angle];
}

/** Angle (radians) between two orientations. */
export function angleBetween(a: Quat, b: Quat): number {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
}

/** Normalised lerp along the shortest arc — plenty for interpolating 4ms apart. */
export function nlerp(a: Quat, b: Quat, t: number): Quat {
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  return normalize([
    a[0] + (b[0] * sign - a[0]) * t,
    a[1] + (b[1] * sign - a[1]) * t,
    a[2] + (b[2] * sign - a[2]) * t,
    a[3] + (b[3] * sign - a[3]) * t,
  ]);
}

export function rotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

/** CSS `matrix3d()` (column-major) for a pure rotation. */
export function toCssMatrix(q: Quat): string {
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  const m = [
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
    0, 0, 0, 1,
  ];
  return `matrix3d(${m.map((n) => n.toFixed(6)).join(',')})`;
}
