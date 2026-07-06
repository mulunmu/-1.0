/** GLSL — 雾面背景 + 粒子光线 + 土星 + Login 横贯丝线 */

export const ribbonVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ribbonFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIntensity;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.02 + vec2(1.7, 1.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float t = uTime * 0.035;
    vec2 flow = vec2(t * 0.22, t * 0.1);

    float n1 = fbm(p * 1.05 + flow);
    float n2 = fbm(p * 1.55 - flow * 0.75);
    float n3 = fbm(p * 0.65 + vec2(t * 0.06, -t * 0.04));

    float mist = smoothstep(0.36, 0.74, n1) * smoothstep(0.28, 0.62, n2);
    mist = pow(mist, 2.0) * 0.2 * uIntensity;

    float bottomBand = smoothstep(-0.6, 0.08, p.y) * smoothstep(0.42, -0.38, p.y);
    float bottomMist = bottomBand * (n3 * 0.45 + 0.55) * 0.16 * uIntensity;

    vec3 base = vec3(0.028, 0.032, 0.048);
    vec3 fogCol = vec3(0.58, 0.62, 0.68);
    gl_FragColor = vec4(base + fogCol * (mist + bottomMist), 1.0);
  }
`;

export const microStarVertexShader = /* glsl */ `
  uniform vec2 uExcludeCenter;
  uniform vec2 uExcludeHalf;
  uniform float uExcludeForce;

  vec2 applyTextRepulsion(vec3 pos) {
    vec2 rel = pos.xy - uExcludeCenter;
    vec2 norm = rel / max(uExcludeHalf, vec2(0.001));
    float d = length(norm);
    if (d < 1.35 && uExcludeForce > 0.001) {
      float push = (1.35 - d) * uExcludeForce;
      return pos.xy + normalize(rel + vec2(0.0001)) * push;
    }
    return pos.xy;
  }

  attribute float aSize;
  attribute float aPhase;
  attribute float aGold;
  attribute float aAngle;
  attribute float aStreak;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeMul;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vAngle;
  varying float vStreak;
  varying float vLen;

  void main() {
    vec3 pos = position;
    pos.x += sin(uTime * 0.16 + aPhase) * 0.03;
    pos.y += cos(uTime * 0.12 + aPhase * 1.6) * 0.024;
    pos.xy = applyTextRepulsion(pos);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float twinkle = 0.82 + 0.18 * sin(uTime * 0.55 + aPhase);
    vAlpha = twinkle;
    vAngle = aAngle + sin(uTime * 0.2 + aPhase) * 0.05;
    vStreak = aStreak;
    vLen = aStreak > 0.5 ? 1.6 + aSize * 3.0 : 0.0;

    vec3 blueWhite = vec3(0.878, 0.906, 1.0);
    vec3 paleGold = vec3(0.988, 0.827, 0.302);
    vColor = aGold > 0.5 ? paleGold : blueWhite;

    float base = aStreak > 0.5 ? 5.5 : 4.0;
    gl_PointSize = max(aSize * uPixelRatio * base * uSizeMul, 1.0);
  }
`;

export const microStarFragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vAngle;
  varying float vStreak;
  varying float vLen;
  uniform float uIntensity;

  float streakAlpha(vec2 c, float angle, float length, float thin) {
    float ca = cos(angle);
    float sa = sin(angle);
    vec2 rc = vec2(c.x * ca + c.y * sa, -c.x * sa + c.y * ca);
    float across = exp(-rc.y * rc.y * thin);
    float along = smoothstep(length * 0.5, -length * 0.5, rc.x);
    float head = smoothstep(-length * 0.08, length * 0.12, rc.x);
    return across * along * head;
  }

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float alpha;
    if (vStreak > 0.5) {
      alpha = streakAlpha(c, vAngle, vLen, 90.0) * vAlpha * 0.7 * uIntensity;
    } else {
      float d = length(c);
      if (d > 0.5) discard;
      float core = exp(-d * d * 32.0);
      float glow = exp(-d * d * 7.0) * 0.22;
      alpha = (core + glow) * vAlpha * 0.62 * uIntensity;
    }
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export const saturnMicroVertexShader = /* glsl */ `
  uniform vec2 uExcludeCenter;
  uniform vec2 uExcludeHalf;
  uniform float uExcludeForce;

  vec2 applyTextRepulsion(vec3 pos) {
    vec2 rel = pos.xy - uExcludeCenter;
    vec2 norm = rel / max(uExcludeHalf, vec2(0.001));
    float d = length(norm);
    if (d < 1.35 && uExcludeForce > 0.001) {
      float push = (1.35 - d) * uExcludeForce;
      return pos.xy + normalize(rel + vec2(0.0001)) * push;
    }
    return pos.xy;
  }

  attribute float aSize;
  attribute float aPhase;
  attribute float aLayer;
  attribute float aGold;
  attribute float aAngle;
  attribute float aStreakLen;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOrtho;
  uniform float uDotOnly;
  uniform vec3 uCorePrimary;
  uniform vec3 uCoreSecondary;
  uniform vec3 uRingPrimary;
  uniform vec3 uRingAccent;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vAngle;
  varying float vStreakLen;
  varying float vLayer;

  void main() {
    vec3 pos = position;

    if (uDotOnly < 0.5) {
      float ringWave = sin(uTime * 0.35 + aPhase + aLayer * 2.5) * 0.01 * (1.0 + aLayer);
      pos.y += ringWave;
      pos.x += sin(uTime * 0.1 + aPhase) * 0.014;
    }
    pos.xy = applyTextRepulsion(pos);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float twinkle = 0.84 + 0.16 * sin(uTime * 0.45 + aPhase * 1.8);
    vAlpha = twinkle;
    vLayer = aLayer;
    vAngle = aAngle + sin(uTime * 0.15 + aPhase) * 0.04;
    vStreakLen = aStreakLen;

    if (aLayer < 0.5) {
      vColor = mix(uCorePrimary, uCoreSecondary, 0.25 + aGold * 0.5);
    } else if (aLayer < 1.5) {
      vColor = mix(uRingPrimary, uRingAccent, 0.1 + aGold * 0.4);
    } else {
      vColor = mix(uRingPrimary, uCoreSecondary, 0.38);
    }

    float sizeBase = aLayer < 0.5 ? 16.0 : (aLayer < 1.5 ? 12.0 : 10.0);
    if (uDotOnly > 0.5) {
      sizeBase = aLayer < 0.5 ? 11.0 : 8.5;
      gl_PointSize = max(aSize * uPixelRatio * sizeBase, 1.0);
    } else if (uOrtho > 0.5) {
      gl_PointSize = max(aSize * uPixelRatio * sizeBase * (0.85 + aStreakLen * 0.15), 1.4);
    } else {
      float sizeMul = aLayer < 0.5 ? 58.0 : 40.0;
      gl_PointSize = aSize * uPixelRatio * (sizeMul / -mv.z);
    }
  }
`;

export const saturnMicroFragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vAngle;
  varying float vStreakLen;
  varying float vLayer;
  uniform float uIntensity;
  uniform float uDotOnly;

  float dotAlpha(vec2 c, float sharpness) {
    float d = length(c);
    if (d > 0.5) return 0.0;
    return exp(-d * d * sharpness);
  }

  float streakAlpha(vec2 c, float angle, float length, float thin) {
    float ca = cos(angle);
    float sa = sin(angle);
    vec2 rc = vec2(c.x * ca + c.y * sa, -c.x * sa + c.y * ca);
    float across = exp(-rc.y * rc.y * thin);
    float along = smoothstep(length * 0.5, -length * 0.5, rc.x);
    float head = smoothstep(-length * 0.06, length * 0.14, rc.x);
    return across * along * head;
  }

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float alpha;

    if (uDotOnly > 0.5) {
      float sharp = vLayer < 0.5 ? 32.0 : 36.0;
      alpha = dotAlpha(c, sharp) * vAlpha * uIntensity * (vLayer < 0.5 ? 1.2 : 0.95);
    } else if (vLayer < 0.5) {
      float d = length(c);
      if (d > 0.5) discard;
      float core = exp(-d * d * 22.0);
      float glow = exp(-d * d * 5.5) * 0.35;
      alpha = (core + glow) * vAlpha * uIntensity * 1.35;
    } else {
      float thin = vLayer < 1.5 ? 88.0 : 95.0;
      alpha = streakAlpha(c, vAngle, vStreakLen, thin) * vAlpha * uIntensity;
      if (vLayer < 1.5) {
        alpha *= 1.15;
      } else {
        alpha *= 0.85;
      }
    }

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export const lightRayVertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aAngle;
  attribute float aLen;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vAngle;
  varying float vLen;

  void main() {
    vec3 pos = position;
    float pulse = sin(uTime * 0.25 + aPhase) * 0.015;
    pos.xy *= 1.0 + pulse;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    vAlpha = 0.55 + 0.45 * sin(uTime * 0.3 + aPhase);
    vAngle = aAngle;
    vLen = aLen;
    gl_PointSize = max(aLen * uPixelRatio * 9.0, 2.0);
  }
`;

export const lightRayFragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vAngle;
  varying float vLen;
  uniform float uIntensity;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float ca = cos(vAngle);
    float sa = sin(vAngle);
    vec2 rc = vec2(c.x * ca + c.y * sa, -c.x * sa + c.y * ca);

    float thin = exp(-rc.y * rc.y * 38.0);
    float along = smoothstep(vLen * 0.55, -vLen * 0.45, rc.x);
    float core = exp(-rc.x * rc.x * 12.0) * step(rc.x, 0.08);
    float alpha = (thin * along * 0.85 + core * 0.4) * vAlpha * uIntensity;

    if (alpha < 0.004) discard;
    vec3 col = mix(vec3(0.98, 0.84, 0.42), vec3(0.75, 0.82, 0.98), smoothstep(-0.2, 0.5, rc.x));
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Login 横贯丝线 — 参考图：左宽右窄蓝色光丝汇聚流动 */
export const horizontalBeamVertexShader = /* glsl */ `
  attribute float aPathT;
  attribute float aStrandOff;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aStreakLen;
  attribute float aStrandHue;
  attribute float aLayer;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uViewport;
  varying float vAlpha;
  varying float vAngle;
  varying float vStreakLen;
  varying float vHue;
  varying float vGrad;
  varying float vLayer;

  float waveY(float xNorm) {
    float pi = 3.14159265;
    return sin(xNorm * pi * 1.8) * 0.04
         + sin(xNorm * pi * 3.2 + 1.1) * 0.018;
  }

  float waveTangent(float xNorm) {
    float e = 0.004;
    return atan(waveY(xNorm + e) - waveY(xNorm - e), e * 2.0);
  }

  void main() {
    float travel = uTime * aSpeed;
    float t = fract(aPathT + travel * 0.03);

    float spread = mix(1.0, 0.08, pow(t, 0.62));
    float halfH = spread * 0.42 * uViewport.y;
    float cy = waveY(t) * uViewport.y;

    float x = (t - 0.5) * uViewport.x * 1.1;
    float y = cy + aStrandOff * halfH;
    y += sin(t * 6.283 + aPhase * 1.7) * halfH * 0.12;
    y += sin(uTime * 0.5 + aPhase) * halfH * 0.06;

    vec3 pos = vec3(x, y, 2.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

    vGrad = t;
    vLayer = aLayer;
    vAngle = waveTangent(t) + aStrandOff * 0.08;
    vStreakLen = aStreakLen;
    vHue = aStrandHue;
    vAlpha = 0.75 + 0.25 * sin(uTime * 0.55 + aPhase * 2.0);

    float sizeMul = aLayer > 0.5 ? 14.0 : mix(42.0, 24.0, t);
    gl_PointSize = max(aSize * uPixelRatio * sizeMul, aLayer > 0.5 ? 4.0 : 10.0);
  }
`;

export const horizontalBeamFragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vAngle;
  varying float vStreakLen;
  varying float vHue;
  varying float vGrad;
  varying float vLayer;
  uniform float uIntensity;

  float flowStreak(vec2 c, float angle, float len) {
    float ca = cos(angle);
    float sa = sin(angle);
    vec2 rc = vec2(c.x * ca + c.y * sa, -c.x * sa + c.y * ca);
    float w = mix(0.14, 0.06, vGrad);
    float across = 1.0 - smoothstep(0.0, w, abs(rc.y));
    float along = smoothstep(len * 0.55, -len * 0.38, rc.x);
    float head = smoothstep(-0.06, 0.1, rc.x);
    return across * along * head;
  }

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float alpha = 0.0;
    vec3 col = vec3(0.2, 0.55, 1.0);

    if (vLayer > 0.5) {
      float d = length(c);
      alpha = exp(-d * d * 5.0) * vAlpha * 0.55;
      col = mix(vec3(0.15, 0.45, 0.95), vec3(0.6, 0.85, 1.0), vHue);
    } else {
      alpha = flowStreak(c, vAngle, vStreakLen) * vAlpha;
      vec3 core = vec3(0.82, 0.94, 1.0);
      vec3 electric = vec3(0.12, 0.52, 1.0);
      vec3 deep = vec3(0.04, 0.22, 0.72);
      float bright = 1.0 - smoothstep(0.0, 0.14, abs(c.y - 0.0));
      col = mix(deep, electric, 0.65 + vHue * 0.2);
      col = mix(col, core, bright * 0.85);
    }

    alpha *= uIntensity;
    if (alpha < 0.001) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Login 银河光带 — 对角 nebula + 蓝紫粉渐变 + 内置深空底 */
export const milkyWayVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const milkyWayFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIntensity;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float hash3(vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.47), sin(0.47), -sin(0.47), cos(0.47));
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = rot * p * 2.03 + vec2(1.6, 9.2);
      a *= 0.5;
    }
    return v;
  }

  float roundStar(vec2 uv, float scale, float density, float rMin, float rMax) {
    vec2 p = uv * scale;
    vec2 cell = floor(p);
    vec2 local = fract(p) - 0.5;
    float seed = hash(cell);
    if (seed > density) return 0.0;

    float br = hash3(cell + 41.7);
    float tw = 0.72 + 0.28 * sin(uTime * (0.4 + br * 1.2) + seed * 6.28);
    float r = mix(rMin, rMax, br);
    float d = length(local);
    return smoothstep(r, 0.0, d) * br * tw;
  }

  float starRiverGrain(vec2 uv, float mask) {
    float g1 = fbm(uv * 18.0) * fbm(uv * 32.0 + 3.1);
    float g2 = fbm(uv * 48.0 - vec2(uTime * 0.02, 0.0));
    return pow(g1 * 0.6 + g2 * 0.4, 2.2) * mask;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float t = uTime * 0.018;
    vec2 flow = vec2(t * 0.07, t * 0.04);

    vec2 diag = normalize(vec2(1.0, -0.82));
    float along = dot(p, diag);
    float across = dot(p, vec2(diag.y, -diag.x));

    float wobble = fbm(p * 1.6 + flow) * 0.14;
    float bandW = 0.32 + wobble;
    float band = exp(-across * across / (bandW * bandW * 0.42));

    float dust = fbm(p * 4.2 + flow * 1.8);
    float dustLane = smoothstep(0.42, 0.7, dust) * 0.38;

    float alongNorm = along * 0.52 + 0.48;
    float core = smoothstep(0.02, 0.28, alongNorm) * smoothstep(0.99, 0.52, alongNorm);
    float nebula = fbm(p * 2.0 + flow) * fbm(p * 4.8 - flow * 0.6);
    nebula = pow(nebula, 1.35);
    float lum = band * core * (nebula * 0.88 + 0.12) * (1.0 - dustLane);

    vec3 colBlue = vec3(0.12, 0.42, 0.92);
    vec3 colCyan = vec3(0.32, 0.8, 1.0);
    vec3 colPurple = vec3(0.62, 0.3, 0.8);
    vec3 colPink = vec3(0.9, 0.4, 0.7);
    vec3 colWarm = vec3(0.98, 0.52, 0.45);

    float ct = clamp(alongNorm + nebula * 0.18 - 0.15, 0.0, 1.0);
    vec3 nebulaCol = mix(colBlue, colCyan, smoothstep(0.0, 0.22, ct));
    nebulaCol = mix(nebulaCol, colPurple, smoothstep(0.22, 0.52, ct));
    nebulaCol = mix(nebulaCol, colPink, smoothstep(0.52, 0.78, ct));
    nebulaCol = mix(nebulaCol, colWarm, smoothstep(0.78, 1.0, ct));

    float bandMask = band * (0.35 + core * 0.65);
    vec2 starUv = p + flow * 0.3;

    float bgStars = roundStar(starUv, 95.0, 0.965, 0.012, 0.028) * 0.55;
    float midStars = roundStar(starUv + 7.3, 155.0, 0.972, 0.008, 0.02) * (0.3 + bandMask * 0.7);
    float riverStars = roundStar(starUv + 19.1, 240.0, 0.978, 0.005, 0.014) * bandMask;
    float fineStars = roundStar(starUv + 33.7, 380.0, 0.984, 0.003, 0.009) * bandMask * core;
    float brightStars = roundStar(starUv + 51.2, 120.0, 0.992, 0.018, 0.045) * bandMask * core;

    float riverGrain = starRiverGrain(p + flow, bandMask * core);
    float starLum = bgStars + midStars + riverStars * 1.4 + fineStars * 1.8 + brightStars * 2.2;
    starLum += riverGrain * 0.65;

    vec3 starTint = mix(vec3(0.78, 0.88, 1.0), mix(colCyan, colPink, ct), bandMask * 0.6);
    vec3 starGlow = starTint * starLum;

    float glow = exp(-across * across / (bandW * bandW * 2.8)) * core * 0.42;
    vec3 glowCol = mix(colCyan, colPink, ct) * glow;

    vec3 bg = vec3(0.006, 0.008, 0.02);
    vec3 col = bg
      + nebulaCol * lum * uIntensity * 1.2
      + glowCol * uIntensity * 0.6
      + starGlow * uIntensity * 0.85;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** 太阳系行星粒子 — 球形/环带柔光点 */
export const planetParticleVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aShade;
  attribute float aLayer;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uGlow;
  uniform float uPointScale;
  uniform float uTwinkle;
  uniform float uMotion;
  varying float vAlpha;
  varying float vShade;
  varying float vLayer;

  void main() {
    vec3 pos = position;
    pos.x += sin(uTime * 0.22 + aPhase) * 0.0015 * uMotion;
    pos.y += cos(uTime * 0.18 + aPhase * 1.3) * 0.0012 * uMotion;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    vAlpha = 0.9 + uTwinkle * 0.1 * sin(uTime * 0.55 + aPhase);
    vShade = aShade;
    vLayer = aLayer;
    gl_PointSize = max(aSize * uPixelRatio * (9.0 + uGlow * 5.0) * uPointScale, 1.4);
  }
`;

export const planetParticleFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform float uIntensity;
  varying float vAlpha;
  varying float vShade;
  varying float vLayer;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    vec3 col = mix(uPrimary, uSecondary, vShade);
    if (vLayer > 0.5) {
      col = mix(col, uAccent, 0.42);
    }

    float core = exp(-d * d * 24.0);
    float glow = exp(-d * d * 6.0) * 0.32;
    float alpha = (core + glow) * vAlpha * uIntensity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;
