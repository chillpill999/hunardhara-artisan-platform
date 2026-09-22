#!/usr/bin/env node
/**
 * Hunardhara Platform - UI Star & Sparkle Marker Validation Guard
 * 
 * Verifies that no unwanted AI-styled star, sparkle, or Gemini-style visual marks
 * exist across the web portal or mobile app source trees.
 * 
 * Disallowed:
 * - Lucide/Flutter/Material icons: Sparkles, Sparkle, Wand, Wand2, Stars, AutoAwesome, auto_awesome
 * - Unicode symbols: ✨, ✦, ✧, ★, ☆, ⭐, 🌟, 💫
 * - Unsanctioned AI marketing badges in UI components
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SCAN_TARGETS = [
  'web-portal/src',
  'mobile-app/lib',
  'presentation_slide_technical_approach.html'
];

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.dart']);

const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.dart_tool',
  '.gemini',
  'coverage',
  '.turbo'
]);

// Disallowed icon identifiers
const FORBIDDEN_ICONS = /\b(Sparkles|Sparkle|Wand2|Wand|Stars|AutoAwesome|auto_awesome)\b/;

// Disallowed unicode star / sparkle emojis and symbols
const FORBIDDEN_UNICODE_CHARS = /[✨✦✧★☆⭐🌟💫]/u;

function walk(targetPath) {
  const fullPath = path.resolve(projectRoot, targetPath);
  if (!fs.existsSync(fullPath)) return [];

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return [fullPath];
  }

  let results = [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;

    const childPath = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(childPath));
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      results.push(childPath);
    }
  }

  return results;
}

function auditFile(filePath) {
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for forbidden icon references
    if (FORBIDDEN_ICONS.test(line)) {
      violations.push({
        file: relativePath,
        line: i + 1,
        rule: 'FORBIDDEN_AI_STAR_ICON',
        content: line.trim()
      });
      continue;
    }

    // Check for forbidden unicode star / sparkle glyphs
    if (FORBIDDEN_UNICODE_CHARS.test(line)) {
      violations.push({
        file: relativePath,
        line: i + 1,
        rule: 'FORBIDDEN_STAR_SPARKLE_UNICODE',
        content: line.trim()
      });
    }
  }

  return violations;
}

function runAudit() {
  console.log('🔍 Hunardhara UI Guard: Auditing for AI star/sparkle markers...');

  const allFiles = [];
  for (const target of SCAN_TARGETS) {
    allFiles.push(...walk(target));
  }

  console.log(`📁 Scanned ${allFiles.length} source files across target directories.`);

  let totalViolations = [];
  for (const file of allFiles) {
    const violations = auditFile(file);
    if (violations.length > 0) {
      totalViolations.push(...violations);
    }
  }

  if (totalViolations.length > 0) {
    console.error(`\n❌ FOUND ${totalViolations.length} UNWANTED STAR/SPARKLE MARKER VIOLATIONS:\n`);
    for (const v of totalViolations) {
      console.error(`  - ${v.file}:${v.line} [${v.rule}]: ${v.content}`);
    }
    console.error('\nPlease replace unwanted star/sparkle symbols with semantic icons (Cpu, Loader2, CheckCircle2, Lightbulb, Eye, ShieldCheck, etc.).');
    process.exit(1);
  }

  console.log('✅ PASS: Zero unwanted star/sparkle/Gemini-style visual markers found.\n');
  process.exit(0);
}

runAudit();
