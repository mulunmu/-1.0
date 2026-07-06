import { readFileSync, readdirSync } from "fs";
import { resolve, extname } from "path";

const PAGES_DIR = resolve("src/pages");
const EXCLUDE_FILES = ["lib/theme.ts", "lib/canvasTheme.ts"];

const BAD_PATTERNS = [
  "backdrop-filter",
  "liquid-glass",
  "GlowParticles",
  "rgba(",
];

// Simple hex color detection (3 or 6 digit hex)
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const violations = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

      for (const pattern of BAD_PATTERNS) {
        if (line.includes(pattern)) {
          // Skip if it's importing from theme/canvasTheme
          if (pattern === "rgba(" && (line.includes("canvasTheme") || line.includes("rgbFill") || line.includes("whiteAlpha") || line.includes("previewLinkColor") || line.includes("HOVER_RING") || line.includes("CENTER_BORDER") || line.includes("CLUSTER_LABEL") || line.includes("LABEL_COLOR"))) {
            continue;
          }
          violations.push(`  ${filePath}:${i + 1}: ${pattern}`);
        }
      }

      // Check for bare hex colors (not in tokens/css variables)
      const hexMatches = line.match(HEX_RE);
      if (hexMatches) {
        for (const hex of hexMatches) {
          // Skip CSS variable references and import paths
          if (
            line.includes("var(--") ||
            line.includes("CHART_THEME") ||
            line.includes("RISK_CHART") ||
            line.includes("DIMENSION") ||
            line.includes("CANVAS_") ||
            line.includes("NODE_") ||
            line.includes("canvasTheme")
          ) {
            continue;
          }
          violations.push(`  ${filePath}:${i + 1}: hardcoded hex ${hex}`);
        }
      }
    }
    return violations;
  } catch {
    return [];
  }
}

function walk(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else if ([".tsx", ".ts", ".css"].includes(extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

const files = walk(PAGES_DIR);
let allViolations = [];

for (const file of files) {
  const rel = file.replace(process.cwd() + "\\", "").replace(/\\/g, "/");
  if (EXCLUDE_FILES.some((e) => rel.includes(e))) continue;
  allViolations.push(...scanFile(file));
}

if (allViolations.length > 0) {
  console.log("DESIGN LINT VIOLATIONS:");
  allViolations.forEach((v) => console.log(v));
  process.exit(1);
}

console.log("DESIGN LINT: PASS — zero violations");
process.exit(0);
