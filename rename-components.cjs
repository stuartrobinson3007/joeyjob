#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Convert PascalCase to kebab-case
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Check if a filename is in PascalCase
function isPascalCase(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  return /^[A-Z][a-zA-Z]*$/.test(nameWithoutExt);
}

// Get all .tsx files recursively
function getAllTsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .git directories
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        getAllTsxFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Get all files that might contain imports (ts, tsx, js, jsx)
function getAllSourceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .git directories
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        getAllSourceFiles(filePath, fileList);
      }
    } else if (file.match(/\.(tsx?|jsx?)$/)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Update imports in a file
function updateImportsInFile(filePath, renames) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  renames.forEach(({ oldPath, newPath }) => {
    // Get relative paths for both old and new
    const oldRelative = path.relative(path.dirname(filePath), oldPath);
    const newRelative = path.relative(path.dirname(filePath), newPath);
    
    // Remove .tsx extension for import statements
    const oldImport = oldRelative.replace(/\.tsx$/, '');
    const newImport = newRelative.replace(/\.tsx$/, '');
    
    // Handle different import patterns
    const patterns = [
      // Regular imports with ./ or ../
      { 
        regex: new RegExp(`(from\\s+['"\`])(\\.+/${oldImport.replace(/\\/g, '/')})(['"\`])`, 'g'),
        replacement: `$1${newImport.startsWith('.') ? '' : './'}${newImport.replace(/\\/g, '/')}$3`
      },
      // Imports without extension
      {
        regex: new RegExp(`(from\\s+['"\`])([^'"\`]*/${path.basename(oldImport)})(['"\`])`, 'g'),
        replacement: (match, p1, p2, p3) => {
          const dir = path.dirname(p2);
          return `${p1}${dir}/${path.basename(newImport)}${p3}`;
        }
      },
      // Dynamic imports
      {
        regex: new RegExp(`(import\\s*\\(\\s*['"\`])(\\.+/${oldImport.replace(/\\/g, '/')})(['"\`]\\s*\\))`, 'g'),
        replacement: `$1${newImport.startsWith('.') ? '' : './'}${newImport.replace(/\\/g, '/')}$3`
      },
      // Absolute imports from src
      {
        regex: new RegExp(`(from\\s+['"\`])(src/.*/${path.basename(oldImport)})(['"\`])`, 'g'),
        replacement: (match, p1, p2, p3) => {
          const dir = path.dirname(p2);
          return `${p1}${dir}/${path.basename(newImport)}${p3}`;
        }
      },
      // @ alias imports
      {
        regex: new RegExp(`(from\\s+['"\`])(@/.*/${path.basename(oldImport)})(['"\`])`, 'g'),
        replacement: (match, p1, p2, p3) => {
          const dir = path.dirname(p2);
          return `${p1}${dir}/${path.basename(newImport)}${p3}`;
        }
      }
    ];
    
    patterns.forEach(({ regex, replacement }) => {
      const newContent = content.replace(regex, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

// Main function
function main() {
  const projectRoot = process.cwd();
  
  console.log('🔍 Scanning for .tsx files with PascalCase names...\n');
  
  // Get all .tsx files
  const tsxFiles = getAllTsxFiles(projectRoot);
  
  // Filter to only PascalCase component files
  const filesToRename = tsxFiles.filter(file => {
    const basename = path.basename(file, '.tsx');
    return isPascalCase(basename);
  });
  
  if (filesToRename.length === 0) {
    console.log('✅ No PascalCase .tsx files found to rename.');
    return;
  }
  
  console.log(`Found ${filesToRename.length} files to rename:\n`);
  
  // Prepare rename operations
  const renames = filesToRename.map(oldPath => {
    const dir = path.dirname(oldPath);
    const oldName = path.basename(oldPath, '.tsx');
    const newName = toKebabCase(oldName);
    const newPath = path.join(dir, `${newName}.tsx`);
    
    console.log(`  ${oldName}.tsx → ${newName}.tsx`);
    
    return { oldPath, newPath, oldName, newName };
  });
  
  console.log('\n🔄 Renaming files...\n');
  
  // Perform renames using git mv if in a git repo, otherwise use fs.rename
  let useGit = false;
  try {
    execSync('git status', { stdio: 'ignore' });
    useGit = true;
  } catch (e) {
    // Not a git repo
  }
  
  renames.forEach(({ oldPath, newPath, oldName, newName }) => {
    try {
      if (useGit) {
        // Check if file is tracked by git
        try {
          execSync(`git ls-files --error-unmatch "${oldPath}"`, { stdio: 'ignore' });
          // File is tracked, use git mv
          execSync(`git mv "${oldPath}" "${newPath}"`, { stdio: 'inherit' });
        } catch (e) {
          // File is not tracked, use regular rename
          fs.renameSync(oldPath, newPath);
        }
      } else {
        fs.renameSync(oldPath, newPath);
      }
      console.log(`  ✅ Renamed: ${oldName}.tsx → ${newName}.tsx`);
    } catch (error) {
      console.error(`  ❌ Failed to rename ${oldName}.tsx:`, error.message);
    }
  });
  
  console.log('\n📝 Updating imports in all source files...\n');
  
  // Get all source files
  const sourceFiles = getAllSourceFiles(projectRoot);
  
  let updatedCount = 0;
  sourceFiles.forEach(file => {
    if (updateImportsInFile(file, renames)) {
      updatedCount++;
    }
  });
  
  console.log(`  ✅ Updated imports in ${updatedCount} files`);
  
  console.log('\n🎉 Done! Component files have been renamed and imports updated.');
  console.log('\n⚠️  Please review the changes and test your application.');
  
  if (useGit) {
    console.log('\n💡 Tip: Use "git status" to see all changes and "git diff" to review them.');
  }
}

// Run the script
if (require.main === module) {
  main();
}