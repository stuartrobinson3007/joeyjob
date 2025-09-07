#!/usr/bin/env node

/**
 * Comprehensive Translation Detection Script
 * 
 * This script finds ALL hardcoded English strings in the TanStack application
 * that should be internationalized but aren't yet using translation functions.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIR = './src';
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build'];
const EXCLUDE_FILES = ['/emails/', '/lib/storage/', '/lib/utils/', '/lib/errors/', '/lib/auth/', '/lib/db/', '/routeTree.gen.ts'];
const FILE_EXTENSIONS = ['.tsx', '.ts'];
const TRANSLATION_FUNCTIONS = ['t(', 'tCommon(', 'tNotifications(', 'i18n.t('];

// Files that should be completely skipped (technical utilities)
const SKIP_FILES = [
  'types.ts', 'compose-refs.ts', 'utils.ts', 'constants.ts', 
  'config.ts', 'auth.ts', 'db.ts', 'redis.ts', 'email.ts',
  'image-processor.ts', 'local-storage-service.ts', 'permissions.ts',
  'errors.ts', 'date.ts', 'table-filters.ts'
];

// Routes that are API endpoints (should remain hardcoded)
const API_ROUTES = ['/api/', '/routes/api/'];

// Patterns to detect English text
const ENGLISH_PATTERNS = [
  // JSX text content between tags (including 2-char terms)
  />([^<{]*[A-Za-z]{2,}[^<}]*)</g,
  // Quoted strings with English words (including 2-char terms)
  /"([^"]*[A-Za-z]{2,}[^"]*)"/g,
  /'([^']*[A-Za-z]{2,}[^']*)'/g,
  // Template literals with text
  /`([^`]*[A-Za-z]{2,}[^`]*)`/g,
  // Attributes with text values
  /(placeholder|aria-label|title|alt)=["']([^"']*[A-Za-z]{2,}[^"']*)["']/g,
  // Multiline JSX text (text on its own line between tags)
  /^\s*([A-Za-z][A-Za-z\s]{1,})\s*$/mg,
];

// Patterns to ignore (technical strings)
const IGNORE_PATTERNS = [
  /^[a-z-_]+$/, // kebab-case or snake_case identifiers
  /^[A-Z_]+$/, // SCREAMING_SNAKE_CASE constants
  /className|import|export|from|interface|type|extends/,
  /@\//, // Import paths starting with @/
  /^[a-z]+$/, // Single lowercase words that are likely technical (but keep Title-case words)
  /^https?:\/\//, // URLs
  /^\/[a-z]/, // Route paths like /auth/signin
  /^\d+/, // Numbers
  /^#[0-9a-f]+/i, // Hex colors
  /^rgb|rgba|hsl|hsla/, // Color functions
  /^[a-z]+(-[a-z]+)*$/, // CSS-like patterns
  /className|class=|style=/, // CSS-related
  /^[a-z]+\.[a-z]+/, // Object property access
  /console\.|error:|warn:|log:/, // Console patterns
  /^[a-z_]+\(/, // Function calls
  /[{}\[\]()]/, // Contains brackets/braces
  /^(true|false|null|undefined)$/, // JS literals
  /^[a-z]+(\s[a-z]+)*\s[a-z-\s:()]+$/, // CSS classes with complex patterns
  /(flex|grid|border|bg-|text-|w-|h-|p-|m-|rounded|shadow)/, // Common CSS utility patterns
  
  // Additional technical patterns to ignore
  /React\.|ComponentProps|VariantProps|FieldPath/, // React/TypeScript patterns
  /throw new Error.*must be used within/, // Component usage errors (dev-only)
  /Unknown error|File not found|Rate limit|Internal server/, // Technical server errors
  /Avatar deleted successfully|Webhook processing|No signature/, // API response messages
  /DATABASE_URL|REDIS_URL|environment variable/, // Environment config
  /.{0,3}\s*(void|Promise|React\.Ref|\|\s*undefined)/, // TypeScript type annotations
  /\w+\s*=\s*[A-Za-z]+/, // Type/interface assignments
  /Tanstack Router|TanStack Todo App/, // Framework/app names that should stay
];

/**
 * Check if a string should be ignored
 */
function shouldIgnoreString(str) {
  if (!str || str.length < 3) return true;
  
  // Additional filtering for user-facing content
  const trimmed = str.trim();
  
  // Skip if it's clearly CSS/technical
  if (trimmed.includes('px') || trimmed.includes('%') || trimmed.includes('rem')) return true;
  if (trimmed.includes(':') && !trimmed.includes(' ')) return true; // CSS properties
  if (trimmed.match(/^[a-z-]+$/)) return true; // Single kebab-case words
  if (trimmed.match(/^[0-9.]+[a-z]*$/)) return true; // Numbers with units
  
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(trimmed)) {
      // Debug what pattern is matching
      if (trimmed === 'Status' || trimmed === 'Title' || trimmed === 'Priority') {
        console.log(`    ❌ IGNORE_PATTERN matched "${trimmed}": ${pattern}`);
      }
      return true;
    }
  }
  
  return false;
}

/**
 * Check if line already uses translation function
 */
function usesTranslationFunction(line) {
  return TRANSLATION_FUNCTIONS.some(func => line.includes(func));
}

/**
 * Check if string is likely user-facing content
 */
function isUserFacingContent(str, line) {
  const trimmed = str.trim();
  
  // Must contain actual words, not just technical strings
  if (!trimmed.match(/[A-Z][a-z]+/)) return false;
  
  // Skip console messages (not user-facing)
  if (line.includes('console.') || line.includes('error:') || line.includes('log:')) return false;
  
  // Skip import statements
  if (line.includes('import') || line.includes('from')) return false;
  
  // Skip TypeScript/React technical patterns
  if (line.includes('interface ') || line.includes('type ') || line.includes('extends ')) return false;
  if (line.includes('React.ComponentProps') || line.includes('VariantProps')) return false;
  
  // Skip error boundaries and hooks (developer-facing)
  if (trimmed.includes('must be used within') || trimmed.includes('should be used within')) return false;
  
  // Skip technical error messages
  if (trimmed.includes('Unknown error') || trimmed.includes('File not found')) return false;
  
  // Skip API response messages (should stay hardcoded)
  if (trimmed.includes('server error') || trimmed.includes('Unauthorized') || 
      trimmed.includes('signature') || trimmed.includes('processing failed')) return false;
      
  // Skip environment/config messages  
  if (trimmed.includes('environment variable') || trimmed.includes('required')) return false;
  
  // Skip email template fallback content (development mode fallbacks are fine)
  if (line.includes('fallbackContent') || line.includes('getTranslation') || line.includes('PreviewProps')) return false;
  
  // Skip technical MIME types
  if (trimmed.startsWith('image/') || trimmed.startsWith('application/')) return false;
  
  // Must be more than just a single word unless it's clearly UI text
  if (trimmed.split(' ').length === 1) {
    // Allow single words that are clearly UI text including table headers
    const uiWords = [
      // Action buttons
      'Loading', 'Saving', 'Error', 'Success', 'Warning', 'Info', 'Done', 'Cancel', 'Save', 'Delete', 'Create', 'Update', 'Edit', 'Add', 'Remove',
      // Table headers and form labels
      'Status', 'Title', 'Priority', 'Name', 'Email', 'Role', 'Created', 'Actions', 'User', 'Organization', 'Members', 'Description',
      // Technical abbreviations that are user-facing
      'ID', 'IP', 'OS', 'URL', 'API'
    ];
    return uiWords.includes(trimmed);
  }
  
  return true;
}

/**
 * Classify string priority for translation
 */
function getStringPriority(str, line, filePath) {
  const trimmed = str.trim();
  
  // HIGH: Table headers and column labels (clearly user-facing)
  const tableHeaders = ['Status', 'Title', 'Priority', 'Name', 'Email', 'Role', 'Created', 'Actions', 'User', 'Organization', 'Members', 'ID'];
  if (tableHeaders.includes(trimmed)) return 'HIGH';
  
  // HIGH: UI text visible to users (buttons, labels, messages)
  if (line.includes('placeholder=') || line.includes('aria-label=') || line.includes('title=')) return 'HIGH';
  if (line.includes('Button>') || line.includes('button') || line.includes('<h1>') || line.includes('<h2>')) return 'HIGH';
  if (line.includes('toast.') || line.includes('showError') || line.includes('showSuccess')) return 'HIGH';
  
  // HIGH: Text inside data table context
  if (filePath.includes('table') && /^[A-Z][A-Za-z\s]{0,15}$/.test(trimmed)) return 'HIGH';
  if (line.includes('DataTableHeader') || line.includes('header:')) return 'HIGH';
  
  // HIGH: Server-side validation messages that are shown to users via error handling
  if (line.includes('AppError(') || line.includes('new AppError')) return 'HIGH';
  if (line.includes('throw new ValidationError') || line.includes('ValidationError(')) return 'HIGH';
  if (filePath.includes('.server.ts') && (line.includes('AppError') || line.includes('ValidationError'))) return 'HIGH';
  
  // HIGH: Client-side error fallbacks that users see
  if (line.includes('showError') && line.includes('||')) return 'HIGH';
  if (line.includes('result.error.message ||') || line.includes('error?.message ||')) return 'HIGH';
  
  // MEDIUM: Form validation, dialog content
  if (line.includes('Error(') && !line.includes('AppError')) return 'MEDIUM';
  if (filePath.includes('/components/') || filePath.includes('/features/')) return 'MEDIUM';
  
  // LOW: Technical utilities, development errors, API responses
  if (filePath.includes('/api/') || filePath.includes('/lib/storage/') || filePath.includes('/lib/utils/')) return 'LOW';
  if (line.includes('throw new Error') && line.includes('must be used within')) return 'LOW';
  if (trimmed.includes('Unknown error') || trimmed.includes('environment variable')) return 'LOW';
  
  return 'MEDIUM';
}

/**
 * Get all files to scan
 */
function getFilesToScan(dir) {
  const files = [];
  
  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        if (!EXCLUDE_DIRS.some(exclude => itemPath.includes(exclude))) {
          walkDir(itemPath);
        }
      } else if (FILE_EXTENSIONS.some(ext => item.endsWith(ext))) {
        // Skip technical files and API routes
        const shouldSkip = EXCLUDE_FILES.some(exclude => itemPath.includes(exclude)) ||
                          SKIP_FILES.some(skip => item.endsWith(skip)) ||
                          API_ROUTES.some(api => itemPath.includes(api));
        
        if (!shouldSkip) {
          files.push(itemPath);
        }
      }
    }
  }
  
  walkDir(dir);
  return files;
}

/**
 * Extract hardcoded strings from file content
 */
function extractHardcodedStrings(filePath, content) {
  const hardcodedStrings = [];
  const lines = content.split('\n');
  
  lines.forEach((line, lineIndex) => {
    // Debug for todos-table-page
    if (filePath.includes('todos-table-page') && (line.includes('Title') || line.includes('Status') || line.includes('Priority'))) {
      console.log(`  🔍 DEBUG Line ${lineIndex + 1}: "${line.trim()}"`);
      console.log(`    Uses translation function: ${usesTranslationFunction(line)}`);
    }
    
    // Skip lines that already use translation functions
    if (usesTranslationFunction(line)) return;
    
    // Check for standalone text that's clearly a table header or UI label
    const trimmedLine = line.trim();
    if (/^[A-Z][A-Za-z\s]{0,20}$/.test(trimmedLine)) {
      // This looks like a standalone header/label
      const text = trimmedLine;
      
      // Debug for todos-table-page
      if (filePath.includes('todos-table-page') && (text.includes('Title') || text.includes('Status') || text.includes('Priority'))) {
        console.log(`    🔍 Standalone text found: "${text}"`);
        console.log(`    Should ignore: ${shouldIgnoreString(text)}`);
        console.log(`    Is user-facing: ${isUserFacingContent(text, line)}`);
        console.log(`    Priority: ${getStringPriority(text, line, filePath)}`);
      }
      
      if (!shouldIgnoreString(text) && isUserFacingContent(text, line)) {
        hardcodedStrings.push({
          file: filePath,
          line: lineIndex + 1,
          content: text,
          context: line.trim(),
          type: 'STANDALONE_TEXT',
          priority: getStringPriority(text, line, filePath)
        });
        return; // Don't double-process this line
      }
    }
    
    // Apply each pattern to find hardcoded strings
    for (const pattern of ENGLISH_PATTERNS) {
      pattern.lastIndex = 0; // Reset regex
      let match;
      
      while ((match = pattern.exec(line)) !== null) {
        const text = match[1] || match[2] || match[0];
        
        if (!shouldIgnoreString(text) && isUserFacingContent(text, line)) {
          hardcodedStrings.push({
            file: filePath,
            line: lineIndex + 1,
            content: text,
            context: line.trim(),
            type: detectStringType(line, text),
            priority: getStringPriority(text, line, filePath)
          });
        }
      }
    }
  });
  
  return hardcodedStrings;
}

/**
 * Detect the type of hardcoded string
 */
function detectStringType(line, text) {
  if (line.includes('placeholder=')) return 'PLACEHOLDER';
  if (line.includes('aria-label=')) return 'ARIA_LABEL';
  if (line.includes('title=')) return 'TITLE_ATTR';
  if (line.includes('alt=')) return 'ALT_ATTR';
  if (line.includes('toast.')) return 'TOAST_MESSAGE';
  if (line.includes('throw new Error')) return 'ERROR_MESSAGE';
  if (line.includes('console.')) return 'CONSOLE_MESSAGE';
  if (line.includes('>') && line.includes('<')) return 'JSX_TEXT';
  if (line.includes('=')) return 'PROP_VALUE';
  return 'QUOTED_STRING';
}

/**
 * Generate comprehensive report
 */
function generateReport(hardcodedStrings) {
  const report = {
    totalFiles: 0,
    totalStrings: hardcodedStrings.length,
    byType: {},
    byPriority: {},
    byFile: {},
    strings: hardcodedStrings
  };
  
  // Group by type and priority
  hardcodedStrings.forEach(item => {
    report.byType[item.type] = (report.byType[item.type] || 0) + 1;
    report.byPriority[item.priority] = (report.byPriority[item.priority] || 0) + 1;
    
    if (!report.byFile[item.file]) {
      report.byFile[item.file] = [];
    }
    report.byFile[item.file].push(item);
  });
  
  report.totalFiles = Object.keys(report.byFile).length;
  
  return report;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning for hardcoded strings...\n');
  
  const files = getFilesToScan(SRC_DIR);
  const allHardcodedStrings = [];
  
  let processedFiles = 0;
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const hardcodedStrings = extractHardcodedStrings(filePath, content);
      
      // Debug: Log todos-table-page specifically
      if (filePath.includes('todos-table-page')) {
        console.log(`🔍 DEBUG: Processing ${filePath}`);
        console.log(`Found ${hardcodedStrings.length} hardcoded strings in this file`);
        hardcodedStrings.forEach(str => {
          console.log(`  Line ${str.line}: "${str.content}" (${str.priority})`);
        });
      }
      
      allHardcodedStrings.push(...hardcodedStrings);
      processedFiles++;
      
      if (processedFiles % 50 === 0) {
        console.log(`Processed ${processedFiles}/${files.length} files...`);
      }
    } catch (error) {
      console.warn(`Warning: Could not process ${filePath}:`, error.message);
    }
  }
  
  const report = generateReport(allHardcodedStrings);
  
  // Output results
  console.log(`\n📊 TRANSLATION AUDIT RESULTS:`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files with hardcoded strings: ${report.totalFiles}`);
  console.log(`Total hardcoded strings found: ${report.totalStrings}`);
  
  console.log(`\n📋 By Type:`);
  Object.entries(report.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log(`\n🎯 By Priority:`);
  Object.entries(report.byPriority).forEach(([priority, count]) => {
    const emoji = priority === 'HIGH' ? '🔴' : priority === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`  ${emoji} ${priority}: ${count}`);
  });
  
  console.log(`\n🔍 Detailed Results (HIGH & MEDIUM priority only):\n`);
  
  // Show detailed results grouped by file, filtered by priority
  Object.entries(report.byFile).forEach(([file, strings]) => {
    const highMediumStrings = strings.filter(s => s.priority === 'HIGH' || s.priority === 'MEDIUM');
    if (highMediumStrings.length === 0) return;
    
    console.log(`📁 ${file.replace(SRC_DIR + '/', '')}:`);
    highMediumStrings.forEach(str => {
      const emoji = str.priority === 'HIGH' ? '🔴' : '🟡';
      console.log(`  ${emoji} Line ${str.line}: "${str.content}" (${str.type})`);
      console.log(`    Context: ${str.context.substring(0, 80)}${str.context.length > 80 ? '...' : ''}`);
    });
    console.log('');
  });
  
  // Save detailed report to JSON
  const reportPath = './translation-audit-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`💾 Detailed report saved to: ${reportPath}`);
  
  // Exit with error code if HIGH priority strings found
  const highPriorityCount = report.byPriority.HIGH || 0;
  const mediumPriorityCount = report.byPriority.MEDIUM || 0;
  
  if (highPriorityCount > 0) {
    console.log(`\n🔴 Found ${highPriorityCount} HIGH priority strings that need immediate translation!`);
    if (mediumPriorityCount > 0) {
      console.log(`🟡 Also ${mediumPriorityCount} MEDIUM priority strings to consider.`);
    }
    console.log(`\n💡 Focus on HIGH priority items first - these are user-visible UI text.`);
    process.exit(1);
  } else if (mediumPriorityCount > 0) {
    console.log(`\n🟡 Found ${mediumPriorityCount} MEDIUM priority strings. Consider translating for completeness.`);
    console.log(`✅ No HIGH priority issues - core UI is properly internationalized!`);
  } else {
    console.log(`\n✅ No user-facing hardcoded strings found! All important text is properly internationalized.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, extractHardcodedStrings, generateReport };