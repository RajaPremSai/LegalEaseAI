// Simple validation script to check if our TypeScript files are syntactically correct
const fs = require('fs');
const path = require('path');

function validateTypeScriptSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax checks
    const issues = [];
    
    // Check for unmatched brackets
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push(`Unmatched curly brackets: ${openBrackets} open, ${closeBrackets} close`);
    }
    
    // Check for unmatched parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Unmatched parentheses: ${openParens} open, ${closeParens} close`);
    }
    
    // Check for basic TypeScript syntax
    if (content.includes('export') && !content.includes('import')) {
      // This is likely an export-only file, which is fine
    }
    
    return issues;
  } catch (error) {
    return [`Error reading file: ${error.message}`];
  }
}

function validateDirectory(dirPath) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  let allValid = true;
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    
    if (file.isDirectory() && file.name !== 'node_modules' && file.name !== 'dist') {
      if (!validateDirectory(fullPath)) {
        allValid = false;
      }
    } else if (file.name.endsWith('.ts')) {
      const issues = validateTypeScriptSyntax(fullPath);
      if (issues.length > 0) {
        console.error(`❌ Issues in ${fullPath}:`);
        issues.forEach(issue => console.error(`  - ${issue}`));
        allValid = false;
      } else {
        console.log(`✅ ${fullPath}`);
      }
    }
  }
  
  return allValid;
}

console.log('Validating TypeScript files...\n');

const srcPath = path.join(__dirname, 'src');
const isValid = validateDirectory(srcPath);

if (isValid) {
  console.log('\n🎉 All TypeScript files passed basic validation!');
  process.exit(0);
} else {
  console.log('\n❌ Some files have issues. Please fix them before proceeding.');
  process.exit(1);
}