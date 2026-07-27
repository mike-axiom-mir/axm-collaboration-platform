export const EPSILON = 1e-7;

export function identity4() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function multiply4(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let index = 0; index < 4; index += 1) value += a[index * 4 + row] * b[column * 4 + index];
      out[column * 4 + row] = value;
    }
  }
  return out;
}

export function composeTRS(translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]) {
  const [x, y, z, w] = rotation;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return new Float32Array([
    (1 - (yy + zz)) * scale[0], (xy + wz) * scale[0], (xz - wy) * scale[0], 0,
    (xy - wz) * scale[1], (1 - (xx + zz)) * scale[1], (yz + wx) * scale[1], 0,
    (xz + wy) * scale[2], (yz - wx) * scale[2], (1 - (xx + yy)) * scale[2], 0,
    translation[0], translation[1], translation[2], 1
  ]);
}

export function translation4(x, y, z) {
  const out = identity4();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function scale4(x, y, z) {
  const out = identity4();
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

export function perspective4(fovRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovRadians / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

export function normalize3(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function lookAt4(eye, target, up = [0, 1, 0]) {
  const z = normalize3([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    1
  ]);
}

export function invert4(matrix) {
  const a00 = matrix[0], a01 = matrix[1], a02 = matrix[2], a03 = matrix[3];
  const a10 = matrix[4], a11 = matrix[5], a12 = matrix[6], a13 = matrix[7];
  const a20 = matrix[8], a21 = matrix[9], a22 = matrix[10], a23 = matrix[11];
  const a30 = matrix[12], a31 = matrix[13], a32 = matrix[14], a33 = matrix[15];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  let determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(determinant) < EPSILON) return null;
  determinant = 1 / determinant;
  return new Float32Array([
    (a11 * b11 - a12 * b10 + a13 * b09) * determinant,
    (a02 * b10 - a01 * b11 - a03 * b09) * determinant,
    (a31 * b05 - a32 * b04 + a33 * b03) * determinant,
    (a22 * b04 - a21 * b05 - a23 * b03) * determinant,
    (a12 * b08 - a10 * b11 - a13 * b07) * determinant,
    (a00 * b11 - a02 * b08 + a03 * b07) * determinant,
    (a32 * b02 - a30 * b05 - a33 * b01) * determinant,
    (a20 * b05 - a22 * b02 + a23 * b01) * determinant,
    (a10 * b10 - a11 * b08 + a13 * b06) * determinant,
    (a01 * b08 - a00 * b10 - a03 * b06) * determinant,
    (a30 * b04 - a31 * b02 + a33 * b00) * determinant,
    (a21 * b02 - a20 * b04 - a23 * b00) * determinant,
    (a11 * b07 - a10 * b09 - a12 * b06) * determinant,
    (a00 * b09 - a01 * b07 + a02 * b06) * determinant,
    (a31 * b01 - a30 * b03 - a32 * b00) * determinant,
    (a20 * b03 - a21 * b01 + a22 * b00) * determinant
  ]);
}

export function transformPoint4(matrix, point) {
  const x = point[0], y = point[1], z = point[2];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] || 1;
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w
  ];
}

export function slerp4(a, b, amount) {
  let cosine = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const target = cosine < 0 ? [-b[0], -b[1], -b[2], -b[3]] : b;
  cosine = Math.abs(cosine);
  if (cosine > 0.9995) {
    const out = a.map((value, index) => value + (target[index] - value) * amount);
    const length = Math.hypot(...out) || 1;
    return out.map((value) => value / length);
  }
  const angle = Math.acos(Math.min(1, cosine));
  const sine = Math.sin(angle);
  const left = Math.sin((1 - amount) * angle) / sine;
  const right = Math.sin(amount * angle) / sine;
  return a.map((value, index) => value * left + target[index] * right);
}

export function lerpArray(a, b, amount) {
  return a.map((value, index) => value + (b[index] - value) * amount);
}
