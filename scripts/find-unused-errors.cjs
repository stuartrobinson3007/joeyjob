#!/usr/bin/env node

/**
 * Script to find unused error variables in catch blocks
 * 
 * This script analyzes TypeScript/JavaScript files to identify:
 * 1. Catch blocks with unused error variables
 * 2. Empty catch blocks
 * 3. Silent catches (error logged but not handled)
 * 
 * Usage:
 *   node scripts/find-unused-errors.js
 *   node scripts/find-unused-errors.js --fix (auto-fix by replacing with _error)
 *   node scripts/find-unused-errors.js --strict (fail on any unused errors)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIR = './src';
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const SHOULD_FIX = process.argv.includes('--fix');
const STRICT_MODE = process.argv.includes('--strict');

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Patterns for different types of error handling issues
const PATTERNS = {
  // Completely empty catch block
  emptyCatch: /} catch \(([^)]+)\) \{\s*\}/g,
  
  // Catch with only comments
  commentOnlyCatch: /} catch \(([^)]+)\) \{\s*(\/\/[^\n]*\n\s*)*\}/g,
  
  // General catch block (we'll analyze content)
  catchBlock: /} catch \(([^)]+)\) \{([^}]*)\}/g,
  
  // Useless try/catch that just re-throws
  uselessTryCatch: /try \{([^}]*)\} catch \(([^)]+)\) \{\s*throw \2\s*\}/g,
  
  // Switch case with variable declarations (no braces)
  switchCaseDeclarations: /case [^:]+:\s*(?:const|let|var)\s+/g,
};

// Check if error variable is used in catch block content
function isErrorUsed(errorVar, catchContent) {
  // Clean error variable name (remove type annotations like ": any")
  const cleanErrorVar = errorVar.split(':')[0].trim();
  
  // Remove comments and strings to avoid false positives
  const cleanContent = catchContent
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/'[^']*'/g, "''") // Remove single quoted strings
    .replace(/"[^"]*"/g, '""') // Remove double quoted strings
    .replace(/`[^`]*`/g, '``'); // Remove template literals
  
  // Check if error variable appears in the content
  const errorPattern = new RegExp(`\\b${cleanErrorVar}\\b`, 'g');
  const matches = cleanContent.match(errorPattern);
  
  return matches && matches.length > 0;
}

// Analyze catch block to determine if error handling is appropriate
function analyzeCatchBlock(errorVar, catchContent, context) {
  const trimmedContent = catchContent.trim();
  const cleanErrorVar = errorVar.split(':')[0].trim();
  
  // Empty catch block
  if (!trimmedContent || /^\s*(\/\/[^\n]*\n\s*)*$/.test(trimmedContent)) {
    return {
      type: 'empty',
      severity: 'error',
      message: `Empty catch block with unused error parameter '${errorVar}'`,
      suggestion: `Remove parameter entirely: } catch {`
    };
  }
  
  // Check if error is used
  const errorUsed = isErrorUsed(errorVar, catchContent);
  
  // Handle underscore-prefixed variables (marked as intentionally unused)
  if (cleanErrorVar.startsWith('_')) {
    if (!errorUsed) {
      return {
        type: 'underscore-unused',
        severity: 'error',
        message: `Unused error parameter '${errorVar}' should be removed entirely`,
        suggestion: `Remove parameter: } catch { instead of } catch (${errorVar}) {`
      };
    } else {
      return {
        type: 'underscore-used',
        severity: 'warning',
        message: `Error parameter '${errorVar}' is used but has underscore prefix`,
        suggestion: `Remove underscore prefix: change to '${cleanErrorVar.substring(1)}'`
      };
    }
  }
  
  if (!errorUsed) {
    return {
      type: 'unused',
      severity: 'error',
      message: `Unused error parameter '${errorVar}'`,
      suggestion: `Remove parameter entirely: } catch { or use the error: showError(${cleanErrorVar})`
    };
  }
  
  // Analyze how the error is being used
  const hasShowError = /showError\s*\(/.test(catchContent);
  const hasThrowError = /throw\s+/.test(catchContent);
  const hasUserFacingHandling = hasShowError || hasThrowError || /toast\.(error|warning)/.test(catchContent);
  const hasConsole = /console\.(log|warn|error)/.test(catchContent);
  const hasReturn = /return\s+/.test(catchContent);
  const hasComment = /\/\/.*(?:silent|ignore|skip|intentional)/.test(catchContent);
  
  // Check file context to determine if console-only is appropriate
  const isApiRoute = context.file.includes('/api/');
  const isServerFunction = context.file.includes('.server.');
  const isMiddleware = context.file.includes('middleware');
  const isUtilityHook = context.file.includes('/lib/hooks/') || context.file.includes('/lib/utils/');
  const isLoader = catchContent.includes('return {') && hasReturn;
  
  // Console-only patterns that are acceptable in certain contexts
  const consoleOnlyAcceptableContexts = isApiRoute || isServerFunction || isMiddleware || isLoader || isUtilityHook;
  
  // Console-only error handling
  if (hasConsole && !hasUserFacingHandling) {
    if (consoleOnlyAcceptableContexts || hasComment) {
      return null; // Acceptable - server-side or documented
    } else {
      return {
        type: 'console-only',
        severity: 'warning',
        message: `Catch block only logs error '${errorVar}' but provides no user-facing error handling`,
        suggestion: `Add showError(${cleanErrorVar}) for user-facing error handling, or document why silent`
      };
    }
  }
  
  // Check for proper patterns
  if (hasUserFacingHandling) {
    return null; // Good - proper error handling
  }
  
  // Return with error object (common in loaders and API routes)
  if (hasReturn && (isLoader || isApiRoute)) {
    return null; // Good - appropriate for loaders/API routes
  }
  
  // Check if it's documented as intentional
  if (hasComment) {
    return {
      type: 'documented-silent',
      severity: 'info',
      message: `Documented silent error handling`,
      suggestion: `Consider removing parameter: } catch { if error is truly ignored`
    };
  }
  
  // Pattern that might need investigation
  return {
    type: 'unclear-pattern',
    severity: 'info',
    message: `Error '${errorVar}' usage pattern unclear - may be appropriate`,
    suggestion: `Review if this error handling fits the context`
  };
}

// Get all TypeScript/JavaScript files
function getAllFiles(dir, files = []) {
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and build directories
      if (!['node_modules', '.git', 'dist', 'build', '.next', '.output'].includes(entry)) {
        getAllFiles(fullPath, files);
      }
    } else {
      // Check file extension
      const ext = path.extname(entry);
      if (FILE_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

// Find useless try/catch blocks
function findUselessTryCatch(content, filePath) {
  const issues = [];
  let match;
  
  while ((match = PATTERNS.uselessTryCatch.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    issues.push({
      file: filePath,
      line: lineNumber,
      type: 'useless-try-catch',
      severity: 'error',
      message: `Useless try/catch block that just re-throws the error`,
      suggestion: `Remove try/catch wrapper - let the error propagate naturally`,
      catchContent: match[0]
    });
  }
  
  return issues;
}

// Find switch case declaration issues  
function findSwitchCaseIssues(content, filePath) {
  const issues = [];
  let match;
  
  while ((match = PATTERNS.switchCaseDeclarations.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    issues.push({
      file: filePath,
      line: lineNumber,
      type: 'switch-case-declaration',
      severity: 'error',
      message: `Variable declaration in case block without braces`,
      suggestion: `Add braces around case block: case 'name': { const x = ...; break }`,
      catchContent: match[0]
    });
  }
  
  return issues;
}

// Analyze a single file for all error handling issues
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let issues = [];
  
  // 1. Find catch block issues
  let match;
  const catchRegex = /} catch \(([^)]+)\) \{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  
  while ((match = catchRegex.exec(content)) !== null) {
    const [fullMatch, errorVar, catchContent] = match;
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    const analysis = analyzeCatchBlock(errorVar, catchContent, {
      file: filePath,
      lineNumber,
      fullMatch
    });
    
    if (analysis) {
      issues.push({
        file: filePath,
        line: lineNumber,
        errorVar,
        catchContent: catchContent.trim(),
        ...analysis
      });
    }
  }
  
  // 2. Find useless try/catch blocks
  issues = issues.concat(findUselessTryCatch(content, filePath));
  
  // 3. Find switch case declaration issues  
  issues = issues.concat(findSwitchCaseIssues(content, filePath));
  
  return issues;
}

// Fix unused error variables by renaming them
function fixFile(filePath, issues) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Sort issues by line number in reverse order to avoid offset issues
  const sortedIssues = issues
    .filter(issue => issue.type === 'unused' || issue.type === 'empty')
    .sort((a, b) => b.line - a.line);
  
  for (const issue of sortedIssues) {
    const oldPattern = `} catch (${issue.errorVar}) {`;
    const newPattern = `} catch (_${issue.errorVar}) {`;
    
    if (content.includes(oldPattern)) {
      content = content.replace(oldPattern, newPattern);
      modified = true;
      console.log(`${colors.green}✓${colors.reset} Fixed: ${filePath}:${issue.line} - ${issue.errorVar} → _${issue.errorVar}`);
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  return modified;
}

// Main function
function main() {
  console.log(`${colors.bold}🔍 Finding unused error variables in catch blocks...${colors.reset}\n`);
  
  const files = getAllFiles(SRC_DIR);
  console.log(`📁 Scanning ${files.length} files...\n`);
  
  let totalIssues = 0;
  let fixedFiles = 0;
  const allIssues = [];
  
  for (const filePath of files) {
    try {
      const issues = analyzeFile(filePath);
      
      if (issues.length > 0) {
        allIssues.push(...issues);
        totalIssues += issues.length;
        
        if (SHOULD_FIX) {
          const wasFixed = fixFile(filePath, issues);
          if (wasFixed) fixedFiles++;
        }
      }
    } catch (error) {
      console.warn(`${colors.yellow}⚠${colors.reset} Failed to analyze ${filePath}: ${error.message}`);
    }
  }
  
  // Group issues by severity
  const issuesBySeverity = {
    error: allIssues.filter(i => i.severity === 'error'),
    warning: allIssues.filter(i => i.severity === 'warning'),
    info: allIssues.filter(i => i.severity === 'info')
  };
  
  // Display results
  console.log(`\n${colors.bold}📊 Results:${colors.reset}`);
  console.log(`Total files scanned: ${files.length}`);
  console.log(`Total issues found: ${totalIssues}`);
  
  if (SHOULD_FIX) {
    console.log(`Files fixed: ${fixedFiles}\n`);
  }
  
  // Display issues by severity
  if (issuesBySeverity.error.length > 0) {
    console.log(`\n${colors.red}${colors.bold}❌ ERRORS (${issuesBySeverity.error.length}):${colors.reset}`);
    issuesBySeverity.error.forEach(issue => {
      console.log(`${colors.red}  ${issue.file}:${issue.line}${colors.reset}`);
      console.log(`    ${issue.message}`);
      console.log(`    ${colors.blue}Suggestion: ${issue.suggestion}${colors.reset}`);
      console.log(`    Content: } catch (${issue.errorVar}) { ${issue.catchContent.substring(0, 50)}... }`);
      console.log('');
    });
  }
  
  if (issuesBySeverity.warning.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}⚠ WARNINGS (${issuesBySeverity.warning.length}):${colors.reset}`);
    issuesBySeverity.warning.forEach(issue => {
      console.log(`${colors.yellow}  ${issue.file}:${issue.line}${colors.reset}`);
      console.log(`    ${issue.message}`);
      console.log(`    ${colors.blue}Suggestion: ${issue.suggestion}${colors.reset}`);
      console.log('');
    });
  }
  
  if (issuesBySeverity.info.length > 0) {
    console.log(`\n${colors.blue}${colors.bold}ℹ INFO (${issuesBySeverity.info.length}):${colors.reset}`);
    issuesBySeverity.info.forEach(issue => {
      console.log(`${colors.blue}  ${issue.file}:${issue.line}${colors.reset}`);
      console.log(`    ${issue.message}`);
      console.log(`    ${colors.blue}Suggestion: ${issue.suggestion}${colors.reset}`);
      console.log('');
    });
  }
  
  // Best practices guide
  console.log(`\n${colors.bold}💡 Best Practices for Error Handling:${colors.reset}`);
  console.log(`${colors.green}✓${colors.reset} Use \`_error\` or \`_\` for intentionally unused error variables`);
  console.log(`${colors.green}✓${colors.reset} Always handle or log errors appropriately`);
  console.log(`${colors.green}✓${colors.reset} Use showError(error) for user-facing error handling`);
  console.log(`${colors.green}✓${colors.reset} Use console.error() for debugging information`);
  console.log(`${colors.red}✗${colors.reset} Don't ignore errors silently without indication`);
  
  console.log(`\n${colors.bold}🔧 Common Patterns:${colors.reset}`);
  console.log(`${colors.blue}User-facing errors:${colors.reset} } catch (error) { showError(error) }`);
  console.log(`${colors.blue}Silent with logging:${colors.reset} } catch (error) { console.error('Context:', error) }`);
  console.log(`${colors.blue}Intentionally silent:${colors.reset} } catch (_error) { /* intentionally ignored */ }`);
  console.log(`${colors.blue}Empty when expected:${colors.reset} } catch (_) { /* known to fail, ignored */ }`);
  
  // Exit codes
  if (STRICT_MODE && issuesBySeverity.error.length > 0) {
    console.log(`\n${colors.red}${colors.bold}💥 STRICT MODE: Failing due to error-level issues${colors.reset}`);
    process.exit(1);
  }
  
  if (totalIssues === 0) {
    console.log(`\n${colors.green}${colors.bold}🎉 No unused error variables found!${colors.reset}`);
  }
  
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { analyzeFile, isErrorUsed };