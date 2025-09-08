#!/usr/bin/env node

/**
 * i18n Missing Key Detection Script
 * 
 * This script compares all language locales to find:
 * - Missing translation keys between locales
 * - Duplicate sections within JSON files
 * - Structural inconsistencies in translation files
 * - Extra keys that exist in some locales but not the base locale
 * - Cross-reference issues where code references keys that don't exist in the specified namespace
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const LOCALES_DIR = './src/i18n/locales';
const BASE_LOCALE = 'en'; // The reference locale to compare against
const SRC_DIR = './src'; // Source directory to scan for i18n usage

/**
 * Get all available locales
 */
function getAvailableLocales() {
  try {
    return fs.readdirSync(LOCALES_DIR)
      .filter(item => {
        const itemPath = path.join(LOCALES_DIR, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .sort();
  } catch (error) {
    console.error('❌ Error reading locales directory:', error.message);
    process.exit(1);
  }
}

/**
 * Get all translation files for a locale
 */
function getTranslationFiles(locale) {
  const localePath = path.join(LOCALES_DIR, locale);
  try {
    return fs.readdirSync(localePath)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file.replace('.json', ''),
        path: path.join(localePath, file)
      }));
  } catch (error) {
    console.error(`❌ Error reading locale ${locale}:`, error.message);
    return [];
  }
}

/**
 * Flatten nested JSON object into dot notation keys
 */
function flattenObject(obj, prefix = '') {
  const flattened = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }
  
  return flattened;
}

/**
 * Check for duplicate keys in a JSON object at any level
 */
function findDuplicateKeys(obj, currentPath = '') {
  const duplicates = [];
  const seenKeys = new Set();
  
  // Check for duplicates at current level
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (seenKeys.has(key)) {
      duplicates.push({
        key,
        path: currentPath ? `${currentPath}.${key}` : key
      });
    }
    seenKeys.add(key);
  }
  
  // Recursively check nested objects
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedPath = currentPath ? `${currentPath}.${key}` : key;
      duplicates.push(...findDuplicateKeys(value, nestedPath));
    }
  }
  
  return duplicates;
}

/**
 * Parse JSON file with duplicate key detection
 */
function parseJSONWithDuplicateCheck(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Simple duplicate key detection by parsing the raw content
    const duplicateKeysInText = [];
    const lines = content.split('\n');
    const seenKeys = new Map(); // key -> first occurrence line number
    
    lines.forEach((line, index) => {
      const match = line.match(/^\s*"([^"]+)"\s*:/);
      if (match) {
        const key = match[1];
        const lineNumber = index + 1;
        
        if (seenKeys.has(key)) {
          duplicateKeysInText.push({
            key,
            firstOccurrence: seenKeys.get(key),
            duplicate: lineNumber,
            line: line.trim()
          });
        } else {
          seenKeys.set(key, lineNumber);
        }
      }
    });
    
    const parsedData = JSON.parse(content);
    return {
      data: parsedData,
      duplicatesInText: duplicateKeysInText
    };
  } catch (error) {
    console.error(`❌ Error parsing ${filePath}:`, error.message);
    return { data: {}, duplicatesInText: [] };
  }
}

/**
 * Load all translation data
 */
function loadAllTranslations() {
  const locales = getAvailableLocales();
  const translations = {};
  const issues = [];
  
  console.log('📁 Loading translation files...\n');
  
  for (const locale of locales) {
    translations[locale] = {};
    const files = getTranslationFiles(locale);
    
    console.log(`  Loading ${locale}:`);
    
    for (const file of files) {
      const { data, duplicatesInText } = parseJSONWithDuplicateCheck(file.path);
      translations[locale][file.name] = data;
      
      console.log(`    ✓ ${file.name}.json`);
      
      // Report duplicate keys
      if (duplicatesInText.length > 0) {
        issues.push({
          type: 'DUPLICATE_KEYS',
          locale,
          file: file.name,
          issues: duplicatesInText
        });
      }
    }
  }
  
  return { translations, issues };
}

/**
 * Find missing keys by comparing all locales against base locale
 */
function findMissingKeys(translations) {
  const locales = Object.keys(translations);
  const baseLocale = translations[BASE_LOCALE];
  
  if (!baseLocale) {
    console.error(`❌ Base locale '${BASE_LOCALE}' not found!`);
    return [];
  }
  
  const missingKeys = [];
  const extraKeys = [];
  
  // Get all translation files from base locale
  const baseFiles = Object.keys(baseLocale);
  
  for (const file of baseFiles) {
    const baseTranslation = flattenObject(baseLocale[file]);
    const baseKeySet = new Set(Object.keys(baseTranslation));
    
    // Check each locale against base
    for (const locale of locales) {
      if (locale === BASE_LOCALE) continue;
      
      const localeTranslation = translations[locale][file];
      if (!localeTranslation) {
        missingKeys.push({
          locale,
          file,
          type: 'MISSING_FILE',
          keys: Array.from(baseKeySet)
        });
        continue;
      }
      
      const flatLocaleTranslation = flattenObject(localeTranslation);
      const localeKeySet = new Set(Object.keys(flatLocaleTranslation));
      
      // Find missing keys (in base but not in locale)
      const missing = [];
      for (const key of baseKeySet) {
        if (!localeKeySet.has(key)) {
          missing.push(key);
        }
      }
      
      if (missing.length > 0) {
        missingKeys.push({
          locale,
          file,
          type: 'MISSING_KEYS',
          keys: missing
        });
      }
      
      // Find extra keys (in locale but not in base)
      const extra = [];
      for (const key of localeKeySet) {
        if (!baseKeySet.has(key)) {
          extra.push(key);
        }
      }
      
      if (extra.length > 0) {
        extraKeys.push({
          locale,
          file,
          type: 'EXTRA_KEYS',
          keys: extra
        });
      }
    }
  }
  
  return { missingKeys, extraKeys };
}

/**
 * Get all TypeScript/TSX files to scan for i18n usage
 */
function getSourceFiles() {
  const files = [];
  
  function walkDir(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        
        // Skip node_modules, .git, dist, build directories
        if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].some(skip => itemPath.includes(skip))) {
          continue;
        }
        
        try {
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            walkDir(itemPath);
          } else if (item.match(/\.(ts|tsx|js|jsx)$/)) {
            files.push(itemPath);
          }
        } catch (error) {
          // Skip files we can't access
          continue;
        }
      }
    } catch (error) {
      // Skip directories we can't access
      return;
    }
  }
  
  walkDir(SRC_DIR);
  return files;
}

/**
 * Extract default namespace from useTranslation calls in a file
 */
function extractDefaultNamespace(content) {
  // Look for patterns like: const { t } = useTranslation('namespace')
  const useTranslationPattern = /const\s*\{\s*t\s*[^}]*\}\s*=\s*useTranslation\(\s*['"`]([^'"`]+)['"`]\s*\)/;
  const match = content.match(useTranslationPattern);
  return match ? match[1] : 'common'; // Default to 'common' if not found
}

/**
 * Extract namespace mappings from useTranslation calls
 */
function extractNamespaceMappings(content) {
  const mappings = { t: 'common' }; // Default mapping
  
  // Remove comments and normalize whitespace for better parsing
  const cleanContent = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
    .replace(/\/\/.*$/gm, '') // Remove // comments
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  // Look for patterns like: const { t: tErrors } = useTranslation('errors')
  const namedTranslationPattern = /const\s*\{\s*t:\s*(\w+)\s*\}\s*=\s*useTranslation\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let match;
  
  while ((match = namedTranslationPattern.exec(cleanContent)) !== null) {
    const [, varName, namespace] = match;
    mappings[varName] = namespace;
  }
  
  // Look for default t assignment: const { t } = useTranslation('namespace')
  // This pattern is more flexible and handles destructuring variations
  const defaultTranslationPattern = /const\s*\{\s*t\s*[^}]*\}\s*=\s*useTranslation\(\s*['"`]([^'"`]+)['"`]\s*\)/;
  const defaultMatch = cleanContent.match(defaultTranslationPattern);
  if (defaultMatch) {
    mappings.t = defaultMatch[1];
  }
  
  // Also handle multiple useTranslation calls in the same destructuring
  // e.g., const { t } = useTranslation('team'), { t: tCommon } = useTranslation('common')
  const multipleTranslationPattern = /useTranslation\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const translationCalls = [];
  while ((match = multipleTranslationPattern.exec(cleanContent)) !== null) {
    translationCalls.push(match[1]);
  }
  
  // If we have multiple calls, try to map them to their variable names
  const destructuringPattern = /const\s*\{\s*([^}]+)\s*\}\s*=/g;
  while ((match = destructuringPattern.exec(cleanContent)) !== null) {
    const destructuredVars = match[1];
    
    // Look for patterns like "t: tSomething"
    const aliasPattern = /t:\s*(\w+)/g;
    let aliasMatch;
    while ((aliasMatch = aliasPattern.exec(destructuredVars)) !== null) {
      const aliasName = aliasMatch[1];
      // Try to derive namespace from alias (tErrors -> errors, tCommon -> common)
      if (aliasName.startsWith('t') && aliasName.length > 1) {
        const derivedNamespace = aliasName.slice(1).toLowerCase();
        mappings[aliasName] = derivedNamespace;
      }
    }
  }
  
  return mappings;
}

/**
 * Extract i18n key usage from source code with enhanced namespace detection
 */
function extractI18nUsage(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const usages = [];
    
    // Extract namespace mappings for this file
    const namespaceMappings = extractNamespaceMappings(content);
    
    // Patterns to match i18n key usage
    const patterns = [
      // t('namespace:key.path') or t("namespace:key.path") 
      /\bt\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      // tCommon('key.path'), tNotifications('key.path'), etc.
      /\b(t[A-Z][a-zA-Z]*)\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      // i18n.t('namespace:key.path')
      /i18n\.t\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    ];
    
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      patterns.forEach((pattern, patternIndex) => {
        pattern.lastIndex = 0; // Reset regex
        let match;
        
        while ((match = pattern.exec(line)) !== null) {
          let namespace, key;
          
          if (patternIndex === 0) {
            // Standard t('namespace:key') or t('key') format
            const fullKey = match[1];
            if (fullKey.includes(':')) {
              [namespace, key] = fullKey.split(':', 2);
            } else {
              // No namespace specified, use the default namespace for 't'
              namespace = namespaceMappings.t || 'common';
              key = fullKey;
            }
          } else if (patternIndex === 1) {
            // tCommon('key'), tNotifications('key') format
            const funcName = match[1]; // e.g., 'tCommon', 'tErrors'
            key = match[2];
            
            // Look up the namespace for this function name
            namespace = namespaceMappings[funcName];
            if (!namespace) {
              // Fallback: derive from function name (tCommon -> common)
              const derivedName = funcName.replace(/^t/, '').toLowerCase();
              namespace = derivedName || 'common';
            }
          } else if (patternIndex === 2) {
            // i18n.t('namespace:key') format
            const fullKey = match[1];
            if (fullKey.includes(':')) {
              [namespace, key] = fullKey.split(':', 2);
            } else {
              namespace = 'common';
              key = fullKey;
            }
          }
          
          // Skip dynamic keys that can't be statically analyzed
          if (key && key.includes('${')) {
            continue;
          }
          
          if (namespace && key) {
            usages.push({
              file: filePath,
              line: lineIndex + 1,
              namespace,
              key,
              fullKey: `${namespace}:${key}`,
              context: line.trim(),
              match: match[0]
            });
          }
        }
      });
    });
    
    return usages;
  } catch (error) {
    console.warn(`Warning: Could not scan ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Find cross-reference missing keys (code references keys that don't exist)
 */
function findCrossReferenceMissingKeys(translations, allUsages) {
  const crossRefIssues = [];
  const suggestions = [];
  
  // Create a flat map of all available keys per namespace
  const availableKeys = {};
  const allKeysFlat = {}; // namespace -> flattened keys
  
  Object.entries(translations[BASE_LOCALE] || {}).forEach(([namespace, namespaceData]) => {
    const flattened = flattenObject(namespaceData);
    availableKeys[namespace] = new Set(Object.keys(flattened));
    allKeysFlat[namespace] = flattened;
  });
  
  // Check each usage against available keys
  allUsages.forEach(usage => {
    const { namespace, key, fullKey } = usage;
    
    // Check if the namespace exists
    if (!availableKeys[namespace]) {
      crossRefIssues.push({
        type: 'NAMESPACE_NOT_FOUND',
        usage,
        issue: `Namespace '${namespace}' does not exist`,
        availableNamespaces: Object.keys(availableKeys)
      });
      return;
    }
    
    // Check if the key exists in the specified namespace
    if (!availableKeys[namespace].has(key)) {
      const issue = {
        type: 'KEY_NOT_FOUND',
        usage,
        issue: `Key '${key}' not found in namespace '${namespace}'`
      };
      
      // Look for the key in other namespaces
      const foundInNamespaces = [];
      Object.entries(availableKeys).forEach(([ns, keys]) => {
        if (keys.has(key)) {
          foundInNamespaces.push(ns);
        }
      });
      
      if (foundInNamespaces.length > 0) {
        issue.suggestion = `Key '${key}' found in: ${foundInNamespaces.join(', ')}`;
        issue.suggestedFix = `Change to: t('${foundInNamespaces[0]}:${key}')`;
      } else {
        // Look for similar keys in the target namespace
        const similarKeys = [];
        const targetKeys = Array.from(availableKeys[namespace]);
        targetKeys.forEach(availableKey => {
          if (availableKey.toLowerCase().includes(key.toLowerCase()) || 
              key.toLowerCase().includes(availableKey.toLowerCase())) {
            similarKeys.push(availableKey);
          }
        });
        
        if (similarKeys.length > 0) {
          issue.suggestion = `Similar keys in '${namespace}': ${similarKeys.slice(0, 3).join(', ')}`;
        } else {
          issue.suggestion = `Add '${key}' to ${namespace}.json or use a different namespace`;
        }
      }
      
      crossRefIssues.push(issue);
    }
  });
  
  return crossRefIssues;
}

/**
 * Generate comprehensive report
 */
function generateReport(translations, missingKeys, extraKeys, structuralIssues, crossRefIssues = []) {
  const locales = Object.keys(translations);
  const totalFiles = Object.keys(translations[BASE_LOCALE] || {}).length;
  
  let totalMissingKeys = 0;
  let totalExtraKeys = 0;
  
  missingKeys.forEach(issue => {
    totalMissingKeys += issue.keys.length;
  });
  
  extraKeys.forEach(issue => {
    totalExtraKeys += issue.keys.length;
  });
  
  return {
    summary: {
      locales: locales.length,
      baseLocale: BASE_LOCALE,
      filesPerLocale: totalFiles,
      totalMissingKeys,
      totalExtraKeys,
      structuralIssues: structuralIssues.length,
      crossRefIssues: crossRefIssues.length
    },
    missingKeys,
    extraKeys,
    structuralIssues,
    crossRefIssues,
    translations // Full translation data for debugging
  };
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 i18n Missing Key Detection\n');
  console.log(`📍 Analyzing locales in: ${LOCALES_DIR}`);
  console.log(`📌 Base locale: ${BASE_LOCALE}\n`);
  
  // Load all translations
  const { translations, issues: structuralIssues } = loadAllTranslations();
  
  console.log('\n🔍 Analyzing key consistency...\n');
  
  // Find missing and extra keys
  const { missingKeys, extraKeys } = findMissingKeys(translations);
  
  // Scan source code for i18n usage
  console.log('🔍 Scanning source code for i18n key usage...\n');
  const sourceFiles = getSourceFiles();
  const allUsages = [];
  
  let processedFiles = 0;
  for (const filePath of sourceFiles) {
    const usages = extractI18nUsage(filePath);
    allUsages.push(...usages);
    processedFiles++;
    
    if (processedFiles % 100 === 0) {
      console.log(`  Processed ${processedFiles}/${sourceFiles.length} source files...`);
    }
  }
  
  console.log(`✓ Scanned ${sourceFiles.length} source files, found ${allUsages.length} i18n key usages\n`);
  
  // Find cross-reference issues
  console.log('🔍 Checking for cross-reference missing keys...\n');
  const crossRefIssues = findCrossReferenceMissingKeys(translations, allUsages);
  
  // Generate report
  const report = generateReport(translations, missingKeys, extraKeys, structuralIssues, crossRefIssues);
  
  // Output results
  console.log('📊 ANALYSIS RESULTS:\n');
  console.log(`Locales analyzed: ${report.summary.locales}`);
  console.log(`Files per locale: ${report.summary.filesPerLocale}`);
  console.log(`Source files scanned: ${sourceFiles.length}`);
  console.log(`i18n key usages found: ${allUsages.length}`);
  console.log(`Missing keys: ${report.summary.totalMissingKeys}`);
  console.log(`Extra keys: ${report.summary.totalExtraKeys}`);
  console.log(`Structural issues: ${report.summary.structuralIssues}`);
  console.log(`Cross-reference issues: ${report.summary.crossRefIssues}`);
  
  let hasErrors = false;
  
  // Report structural issues
  if (structuralIssues.length > 0) {
    console.log('\n🔴 STRUCTURAL ISSUES:\n');
    hasErrors = true;
    
    structuralIssues.forEach(issue => {
      if (issue.type === 'DUPLICATE_KEYS') {
        console.log(`📁 ${issue.locale}/${issue.file}.json - Duplicate keys:`);
        issue.issues.forEach(dup => {
          console.log(`  ❌ "${dup.key}" appears on lines ${dup.firstOccurrence} and ${dup.duplicate}`);
          console.log(`     Line ${dup.duplicate}: ${dup.line}`);
        });
        console.log('');
      }
    });
  }
  
  // Report missing keys
  if (missingKeys.length > 0) {
    console.log('\n🔴 MISSING KEYS:\n');
    hasErrors = true;
    
    missingKeys.forEach(issue => {
      console.log(`📁 ${issue.locale}/${issue.file}.json:`);
      if (issue.type === 'MISSING_FILE') {
        console.log(`  ❌ Entire file missing (${issue.keys.length} keys)`);
      } else {
        console.log(`  ❌ Missing ${issue.keys.length} keys:`);
        issue.keys.forEach(key => {
          console.log(`     - ${key}`);
        });
      }
      console.log('');
    });
  }
  
  // Report extra keys (warnings)
  if (extraKeys.length > 0) {
    console.log('\n🟡 EXTRA KEYS (not in base locale):\n');
    
    extraKeys.forEach(issue => {
      console.log(`📁 ${issue.locale}/${issue.file}.json:`);
      console.log(`  ⚠️  Extra ${issue.keys.length} keys:`);
      issue.keys.forEach(key => {
        console.log(`     + ${key}`);
      });
      console.log('');
    });
  }
  
  // Report cross-reference issues (CRITICAL)
  if (crossRefIssues.length > 0) {
    console.log('\n🔴 CROSS-REFERENCE ISSUES (Runtime Errors):\n');
    hasErrors = true;
    
    // Group by file for better readability
    const issuesByFile = {};
    crossRefIssues.forEach(issue => {
      const filePath = issue.usage.file.replace(process.cwd(), '').replace(/^\//, '');
      if (!issuesByFile[filePath]) {
        issuesByFile[filePath] = [];
      }
      issuesByFile[filePath].push(issue);
    });
    
    Object.entries(issuesByFile).forEach(([filePath, fileIssues]) => {
      console.log(`📁 ${filePath}:`);
      
      fileIssues.forEach(issue => {
        const { usage } = issue;
        console.log(`  ❌ Line ${usage.line}: ${usage.match}`);
        console.log(`     Issue: ${issue.issue}`);
        if (issue.suggestion) {
          console.log(`     💡 ${issue.suggestion}`);
        }
        if (issue.suggestedFix) {
          console.log(`     🔧 Fix: ${issue.suggestedFix}`);
        }
        console.log(`     Context: ${usage.context.substring(0, 80)}${usage.context.length > 80 ? '...' : ''}`);
        console.log('');
      });
    });
  }
  
  // Save detailed report
  const reportPath = './i18n-missing-keys-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`💾 Detailed report saved to: ${reportPath}\n`);
  
  // Summary
  if (hasErrors) {
    if (crossRefIssues.length > 0) {
      console.log(`🔴 Found ${crossRefIssues.length} CRITICAL cross-reference issues causing runtime errors!`);
      console.log('💡 These are the "missingKey" errors you see in the console.');
      console.log('🔧 Fix by either adding keys to the target namespace or changing the namespace in code.');
    }
    if (structuralIssues.length > 0 || missingKeys.length > 0) {
      console.log('🔴 Also found structural and missing key issues.');
      console.log('💡 Focus on cross-reference issues first (runtime errors), then structural issues.');
    }
    process.exit(1);
  } else if (extraKeys.length > 0) {
    console.log('🟡 Minor inconsistencies found (extra keys), but no critical issues.');
    console.log('✅ All required translation keys are present and correctly referenced!');
  } else {
    console.log('✅ Perfect! All locales have consistent translation keys and all code references are valid.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, findMissingKeys, loadAllTranslations };