#!/usr/bin/env node

/**
 * Requirements Validation Script
 * Validates that all requirements from the spec are covered by tests
 */

const fs = require('fs');
const path = require('path');

class RequirementsValidator {
  constructor() {
    this.requirements = [];
    this.testCoverage = new Map();
    this.validationResults = {
      totalRequirements: 0,
      coveredRequirements: 0,
      uncoveredRequirements: [],
      testFiles: [],
      coverageReport: {}
    };
  }

  async validateRequirements() {
    console.log('🔍 Validating Requirements Coverage');
    console.log('===================================');

    try {
      // Step 1: Parse requirements from spec
      await this.parseRequirements();
      
      // Step 2: Analyze test files for requirement coverage
      await this.analyzeTestCoverage();
      
      // Step 3: Generate coverage report
      await this.generateCoverageReport();
      
      // Step 4: Validate completeness
      this.validateCompleteness();
      
      console.log('✅ Requirements validation completed');
      
    } catch (error) {
      console.error('❌ Requirements validation failed:', error.message);
      process.exit(1);
    }
  }

  async parseRequirements() {
    console.log('📋 Parsing requirements from specification...');
    
    const requirementsPath = '.kiro/specs/legal-document-ai-assistant/requirements.md';
    
    if (!fs.existsSync(requirementsPath)) {
      throw new Error('Requirements file not found');
    }

    const requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
    
    // Parse requirements using regex
    const requirementPattern = /### Requirement (\d+)[\s\S]*?#### Acceptance Criteria\s*((?:\d+\.\s+.*?\n?)*)/g;
    let match;

    while ((match = requirementPattern.exec(requirementsContent)) !== null) {
      const requirementNumber = match[1];
      const acceptanceCriteria = match[2];
      
      // Parse individual acceptance criteria
      const criteriaPattern = /(\d+)\.\s+(.*?)(?=\n\d+\.|$)/g;
      const criteria = [];
      let criteriaMatch;
      
      while ((criteriaMatch = criteriaPattern.exec(acceptanceCriteria)) !== null) {
        criteria.push({
          id: `${requirementNumber}.${criteriaMatch[1]}`,
          text: criteriaMatch[2].trim()
        });
      }

      this.requirements.push({
        id: requirementNumber,
        acceptanceCriteria: criteria
      });
    }

    this.validationResults.totalRequirements = this.requirements.length;
    console.log(`   Found ${this.requirements.length} requirements with ${this.getTotalCriteria()} acceptance criteria`);
  }

  getTotalCriteria() {
    return this.requirements.reduce((total, req) => total + req.acceptanceCriteria.length, 0);
  }

  async analyzeTestCoverage() {
    console.log('🧪 Analyzing test coverage...');
    
    const testDirectories = [
      'apps/frontend/src/__tests__',
      'apps/backend/src/__tests__',
      'packages/shared/src/__tests__'
    ];

    for (const testDir of testDirectories) {
      if (fs.existsSync(testDir)) {
        await this.analyzeTestDirectory(testDir);
      }
    }

    console.log(`   Analyzed ${this.validationResults.testFiles.length} test files`);
  }

  async analyzeTestDirectory(directory) {
    const files = this.getAllTestFiles(directory);
    
    for (const file of files) {
      const testContent = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(process.cwd(), file);
      
      const testFile = {
        path: relativePath,
        requirements: this.extractRequirementReferences(testContent),
        testCases: this.extractTestCases(testContent)
      };

      this.validationResults.testFiles.push(testFile);
      
      // Map requirements to test files
      testFile.requirements.forEach(reqId => {
        if (!this.testCoverage.has(reqId)) {
          this.testCoverage.set(reqId, []);
        }
        this.testCoverage.get(reqId).push(relativePath);
      });
    }
  }

  getAllTestFiles(directory) {
    const files = [];
    
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (item.endsWith('.test.ts') || item.endsWith('.test.tsx')) {
          files.push(fullPath);
        }
      }
    };

    scanDirectory(directory);
    return files;
  }

  extractRequirementReferences(content) {
    const requirements = [];
    
    // Look for requirement references in comments and test descriptions
    const patterns = [
      /_Requirements?:\s*([\d\.,\s]+)_/g,
      /Requirements?:\s*([\d\.,\s]+)/g,
      /Requirement\s+(\d+(?:\.\d+)?)/g,
      /req(?:uirement)?\s*(\d+(?:\.\d+)?)/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const reqText = match[1];
        
        // Parse requirement IDs (e.g., "1.1, 2.3, 4.1")
        const reqIds = reqText.split(/[,\s]+/)
          .map(id => id.trim())
          .filter(id => /^\d+(\.\d+)?$/.test(id));
        
        requirements.push(...reqIds);
      }
    });

    return [...new Set(requirements)]; // Remove duplicates
  }

  extractTestCases(content) {
    const testCases = [];
    
    // Extract test case descriptions
    const testPattern = /(?:test|it)\s*\(\s*['"`](.*?)['"`]/g;
    let match;
    
    while ((match = testPattern.exec(content)) !== null) {
      testCases.push(match[1]);
    }

    return testCases;
  }

  generateCoverageReport() {
    console.log('📊 Generating coverage report...');
    
    // Calculate coverage for each requirement
    this.requirements.forEach(requirement => {
      const reqId = requirement.id;
      const coveredCriteria = [];
      const uncoveredCriteria = [];

      requirement.acceptanceCriteria.forEach(criteria => {
        const criteriaId = criteria.id;
        const testFiles = this.testCoverage.get(reqId) || this.testCoverage.get(criteriaId) || [];
        
        if (testFiles.length > 0) {
          coveredCriteria.push({
            ...criteria,
            testFiles
          });
        } else {
          uncoveredCriteria.push(criteria);
        }
      });

      const coveragePercentage = (coveredCriteria.length / requirement.acceptanceCriteria.length) * 100;
      
      this.validationResults.coverageReport[reqId] = {
        requirement: reqId,
        totalCriteria: requirement.acceptanceCriteria.length,
        coveredCriteria: coveredCriteria.length,
        uncoveredCriteria: uncoveredCriteria.length,
        coveragePercentage,
        covered: coveredCriteria,
        uncovered: uncoveredCriteria
      };

      if (coveragePercentage === 100) {
        this.validationResults.coveredRequirements++;
      } else {
        this.validationResults.uncoveredRequirements.push({
          id: reqId,
          coveragePercentage,
          uncoveredCriteria
        });
      }
    });
  }

  validateCompleteness() {
    console.log('✅ Validating completeness...');
    
    const overallCoverage = (this.validationResults.coveredRequirements / this.validationResults.totalRequirements) * 100;
    
    console.log('\n📋 Coverage Summary');
    console.log('==================');
    console.log(`Total Requirements: ${this.validationResults.totalRequirements}`);
    console.log(`Fully Covered: ${this.validationResults.coveredRequirements}`);
    console.log(`Partially/Uncovered: ${this.validationResults.uncoveredRequirements.length}`);
    console.log(`Overall Coverage: ${overallCoverage.toFixed(1)}%`);

    // Detailed coverage by requirement
    console.log('\n📊 Detailed Coverage');
    console.log('====================');
    
    Object.values(this.validationResults.coverageReport).forEach(report => {
      const status = report.coveragePercentage === 100 ? '✅' : 
                    report.coveragePercentage > 0 ? '⚠️' : '❌';
      
      console.log(`${status} Requirement ${report.requirement}: ${report.coveragePercentage.toFixed(1)}% (${report.coveredCriteria}/${report.totalCriteria})`);
      
      if (report.uncovered.length > 0) {
        report.uncovered.forEach(criteria => {
          console.log(`     Missing: ${criteria.id} - ${criteria.text.substring(0, 80)}...`);
        });
      }
    });

    // Critical gaps
    const criticalGaps = this.validationResults.uncoveredRequirements.filter(req => req.coveragePercentage < 50);
    
    if (criticalGaps.length > 0) {
      console.log('\n❌ Critical Coverage Gaps');
      console.log('=========================');
      
      criticalGaps.forEach(gap => {
        console.log(`Requirement ${gap.id}: ${gap.coveragePercentage.toFixed(1)}% coverage`);
        gap.uncoveredCriteria.forEach(criteria => {
          console.log(`   - ${criteria.text}`);
        });
      });
    }

    // Test quality analysis
    this.analyzeTestQuality();

    // Save detailed report
    this.saveDetailedReport();

    // Validation thresholds
    if (overallCoverage < 85) {
      console.log('\n❌ VALIDATION FAILED: Coverage below 85% threshold');
      process.exit(1);
    } else if (criticalGaps.length > 0) {
      console.log('\n⚠️ WARNING: Critical coverage gaps detected');
      process.exit(1);
    } else {
      console.log('\n✅ VALIDATION PASSED: All requirements adequately covered');
    }
  }

  analyzeTestQuality() {
    console.log('\n🔍 Test Quality Analysis');
    console.log('========================');

    const qualityMetrics = {
      totalTestCases: 0,
      e2eTests: 0,
      unitTests: 0,
      integrationTests: 0,
      performanceTests: 0,
      securityTests: 0,
      accessibilityTests: 0
    };

    this.validationResults.testFiles.forEach(testFile => {
      qualityMetrics.totalTestCases += testFile.testCases.length;
      
      const filePath = testFile.path.toLowerCase();
      const content = fs.readFileSync(testFile.path, 'utf8').toLowerCase();
      
      if (filePath.includes('e2e') || content.includes('end-to-end')) {
        qualityMetrics.e2eTests++;
      }
      if (filePath.includes('unit') || content.includes('unit test')) {
        qualityMetrics.unitTests++;
      }
      if (filePath.includes('integration') || content.includes('integration test')) {
        qualityMetrics.integrationTests++;
      }
      if (filePath.includes('performance') || content.includes('performance test')) {
        qualityMetrics.performanceTests++;
      }
      if (filePath.includes('security') || content.includes('security test')) {
        qualityMetrics.securityTests++;
      }
      if (filePath.includes('accessibility') || content.includes('accessibility test')) {
        qualityMetrics.accessibilityTests++;
      }
    });

    console.log(`Total Test Cases: ${qualityMetrics.totalTestCases}`);
    console.log(`E2E Tests: ${qualityMetrics.e2eTests}`);
    console.log(`Unit Tests: ${qualityMetrics.unitTests}`);
    console.log(`Integration Tests: ${qualityMetrics.integrationTests}`);
    console.log(`Performance Tests: ${qualityMetrics.performanceTests}`);
    console.log(`Security Tests: ${qualityMetrics.securityTests}`);
    console.log(`Accessibility Tests: ${qualityMetrics.accessibilityTests}`);

    // Quality recommendations
    const recommendations = [];
    
    if (qualityMetrics.e2eTests < 5) {
      recommendations.push('Consider adding more end-to-end tests for complete user workflows');
    }
    if (qualityMetrics.performanceTests < 3) {
      recommendations.push('Add more performance tests for load and stress testing');
    }
    if (qualityMetrics.securityTests < 3) {
      recommendations.push('Increase security test coverage for vulnerability assessment');
    }
    if (qualityMetrics.accessibilityTests < 2) {
      recommendations.push('Add accessibility tests to ensure WCAG compliance');
    }

    if (recommendations.length > 0) {
      console.log('\n💡 Quality Recommendations:');
      recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
  }

  saveDetailedReport() {
    const reportPath = path.join(process.cwd(), 'test-reports', 'requirements-coverage.json');
    
    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const detailedReport = {
      timestamp: new Date().toISOString(),
      summary: this.validationResults,
      requirements: this.requirements,
      testCoverage: Object.fromEntries(this.testCoverage),
      coverageReport: this.validationResults.coverageReport
    };

    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new RequirementsValidator();
  validator.validateRequirements().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = RequirementsValidator;