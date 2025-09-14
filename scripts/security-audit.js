#!/usr/bin/env node

/**
 * Security and Compliance Audit Script
 * Performs comprehensive security checks and compliance validation
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class SecurityAudit {
  constructor() {
    this.auditResults = {
      timestamp: new Date(),
      overallScore: 0,
      categories: {
        dependencies: { score: 0, issues: [], recommendations: [] },
        codeQuality: { score: 0, issues: [], recommendations: [] },
        configuration: { score: 0, issues: [], recommendations: [] },
        dataProtection: { score: 0, issues: [], recommendations: [] },
        authentication: { score: 0, issues: [], recommendations: [] },
        encryption: { score: 0, issues: [], recommendations: [] },
        compliance: { score: 0, issues: [], recommendations: [] }
      },
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0
      }
    };
  }

  async runAudit() {
    console.log('🔒 Starting Security and Compliance Audit');
    console.log('==========================================');

    try {
      await this.auditDependencies();
      await this.auditCodeQuality();
      await this.auditConfiguration();
      await this.auditDataProtection();
      await this.auditAuthentication();
      await this.auditEncryption();
      await this.auditCompliance();

      this.calculateOverallScore();
      await this.generateReport();

      console.log('✅ Security audit completed');
      
      if (this.auditResults.summary.criticalIssues > 0) {
        console.log('❌ CRITICAL ISSUES FOUND - Immediate action required');
        process.exit(1);
      } else if (this.auditResults.summary.highIssues > 0) {
        console.log('⚠️ HIGH PRIORITY ISSUES - Should be addressed soon');
        process.exit(1);
      } else {
        console.log('✅ No critical security issues found');
      }

    } catch (error) {
      console.error('❌ Security audit failed:', error.message);
      process.exit(1);
    }
  }

  async auditDependencies() {
    console.log('📦 Auditing Dependencies...');
    
    try {
      // Check for known vulnerabilities
      const auditResult = await this.runCommand('npm audit --json');
      const auditData = JSON.parse(auditResult.stdout);

      if (auditData.vulnerabilities) {
        Object.values(auditData.vulnerabilities).forEach(vuln => {
          const severity = vuln.severity;
          const issue = {
            type: 'vulnerability',
            severity,
            description: `${vuln.name}: ${vuln.title}`,
            recommendation: `Update to version ${vuln.fixAvailable?.version || 'latest'}`
          };

          this.auditResults.categories.dependencies.issues.push(issue);
        });
      }

      // Check for outdated packages
      const outdatedResult = await this.runCommand('npm outdated --json');
      if (outdatedResult.stdout) {
        const outdatedData = JSON.parse(outdatedResult.stdout);
        
        Object.entries(outdatedData).forEach(([pkg, info]) => {
          const issue = {
            type: 'outdated',
            severity: 'low',
            description: `${pkg} is outdated (current: ${info.current}, latest: ${info.latest})`,
            recommendation: `Update ${pkg} to latest version`
          };

          this.auditResults.categories.dependencies.issues.push(issue);
        });
      }

      // Calculate score
      const criticalVulns = this.auditResults.categories.dependencies.issues
        .filter(i => i.severity === 'critical').length;
      const highVulns = this.auditResults.categories.dependencies.issues
        .filter(i => i.severity === 'high').length;

      this.auditResults.categories.dependencies.score = Math.max(0, 100 - (criticalVulns * 30) - (highVulns * 15));

      console.log(`   Dependencies Score: ${this.auditResults.categories.dependencies.score}/100`);

    } catch (error) {
      console.log('   ⚠️ Could not complete dependency audit:', error.message);
      this.auditResults.categories.dependencies.score = 50; // Partial score if audit fails
    }
  }

  async auditCodeQuality() {
    console.log('🔍 Auditing Code Quality...');

    try {
      // Check for common security anti-patterns
      const securityPatterns = [
        {
          pattern: /console\.log\(/g,
          severity: 'low',
          description: 'Console.log statements found - may leak sensitive information',
          recommendation: 'Remove console.log statements or use proper logging'
        },
        {
          pattern: /eval\(/g,
          severity: 'critical',
          description: 'eval() usage found - major security risk',
          recommendation: 'Remove eval() usage and use safer alternatives'
        },
        {
          pattern: /innerHTML\s*=/g,
          severity: 'high',
          description: 'innerHTML usage found - potential XSS vulnerability',
          recommendation: 'Use textContent or proper sanitization'
        },
        {
          pattern: /document\.write\(/g,
          severity: 'high',
          description: 'document.write() usage found - potential XSS vulnerability',
          recommendation: 'Use safer DOM manipulation methods'
        },
        {
          pattern: /password.*=.*['"]/gi,
          severity: 'critical',
          description: 'Hardcoded password found',
          recommendation: 'Use environment variables for sensitive data'
        },
        {
          pattern: /api[_-]?key.*=.*['"]/gi,
          severity: 'critical',
          description: 'Hardcoded API key found',
          recommendation: 'Use environment variables for API keys'
        }
      ];

      const codeFiles = this.getAllCodeFiles();
      
      for (const file of codeFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        securityPatterns.forEach(pattern => {
          const matches = content.match(pattern.pattern);
          if (matches) {
            const issue = {
              type: 'code_security',
              severity: pattern.severity,
              description: `${pattern.description} in ${file}`,
              recommendation: pattern.recommendation,
              file,
              occurrences: matches.length
            };

            this.auditResults.categories.codeQuality.issues.push(issue);
          }
        });
      }

      // Calculate score
      const criticalIssues = this.auditResults.categories.codeQuality.issues
        .filter(i => i.severity === 'critical').length;
      const highIssues = this.auditResults.categories.codeQuality.issues
        .filter(i => i.severity === 'high').length;

      this.auditResults.categories.codeQuality.score = Math.max(0, 100 - (criticalIssues * 25) - (highIssues * 10));

      console.log(`   Code Quality Score: ${this.auditResults.categories.codeQuality.score}/100`);

    } catch (error) {
      console.log('   ⚠️ Could not complete code quality audit:', error.message);
      this.auditResults.categories.codeQuality.score = 50;
    }
  }

  async auditConfiguration() {
    console.log('⚙️ Auditing Configuration...');

    try {
      const configChecks = [
        {
          file: '.env.example',
          required: true,
          description: 'Environment variables template',
          check: (content) => content.includes('DATABASE_URL') && content.includes('JWT_SECRET')
        },
        {
          file: 'apps/backend/src/config/security.ts',
          required: true,
          description: 'Security configuration',
          check: (content) => content.includes('helmet') && content.includes('cors')
        },
        {
          file: 'apps/backend/firestore.rules',
          required: true,
          description: 'Firestore security rules',
          check: (content) => content.includes('auth') && !content.includes('allow read, write: if true')
        }
      ];

      configChecks.forEach(check => {
        if (check.required && !fs.existsSync(check.file)) {
          const issue = {
            type: 'missing_config',
            severity: 'high',
            description: `Missing required configuration file: ${check.file}`,
            recommendation: `Create ${check.description} file`
          };

          this.auditResults.categories.configuration.issues.push(issue);
        } else if (fs.existsSync(check.file)) {
          const content = fs.readFileSync(check.file, 'utf8');
          
          if (check.check && !check.check(content)) {
            const issue = {
              type: 'config_issue',
              severity: 'medium',
              description: `Configuration issue in ${check.file}`,
              recommendation: `Review and fix ${check.description}`
            };

            this.auditResults.categories.configuration.issues.push(issue);
          }
        }
      });

      // Check for insecure configurations
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      if (packageJson.scripts && packageJson.scripts.start && packageJson.scripts.start.includes('--inspect')) {
        const issue = {
          type: 'insecure_config',
          severity: 'medium',
          description: 'Debug mode enabled in production script',
          recommendation: 'Remove --inspect flag from production start script'
        };

        this.auditResults.categories.configuration.issues.push(issue);
      }

      // Calculate score
      const highIssues = this.auditResults.categories.configuration.issues
        .filter(i => i.severity === 'high').length;
      const mediumIssues = this.auditResults.categories.configuration.issues
        .filter(i => i.severity === 'medium').length;

      this.auditResults.categories.configuration.score = Math.max(0, 100 - (highIssues * 20) - (mediumIssues * 10));

      console.log(`   Configuration Score: ${this.auditResults.categories.configuration.score}/100`);

    } catch (error) {
      console.log('   ⚠️ Could not complete configuration audit:', error.message);
      this.auditResults.categories.configuration.score = 50;
    }
  }

  async auditDataProtection() {
    console.log('🛡️ Auditing Data Protection...');

    try {
      const dataProtectionChecks = [
        {
          description: 'Privacy policy implementation',
          check: () => fs.existsSync('docs/privacy-policy.md'),
          severity: 'high'
        },
        {
          description: 'Data retention policy',
          check: () => {
            const files = this.getAllCodeFiles();
            return files.some(file => {
              const content = fs.readFileSync(file, 'utf8');
              return content.includes('24 hours') && content.includes('delete');
            });
          },
          severity: 'high'
        },
        {
          description: 'GDPR compliance features',
          check: () => {
            const files = this.getAllCodeFiles();
            return files.some(file => {
              const content = fs.readFileSync(file, 'utf8');
              return content.includes('GDPR') || content.includes('data export') || content.includes('right to be forgotten');
            });
          },
          severity: 'high'
        },
        {
          description: 'Data encryption at rest',
          check: () => {
            const files = this.getAllCodeFiles();
            return files.some(file => {
              const content = fs.readFileSync(file, 'utf8');
              return content.includes('encrypt') && (content.includes('AES') || content.includes('crypto'));
            });
          },
          severity: 'critical'
        }
      ];

      dataProtectionChecks.forEach(check => {
        if (!check.check()) {
          const issue = {
            type: 'data_protection',
            severity: check.severity,
            description: `Missing or incomplete: ${check.description}`,
            recommendation: `Implement ${check.description}`
          };

          this.auditResults.categories.dataProtection.issues.push(issue);
        }
      });

      // Calculate score
      const criticalIssues = this.auditResults.categories.dataProtection.issues
        .filter(i => i.severity === 'critical').length;
      const highIssues = this.auditResults.categories.dataProtection.issues
        .filter(i => i.severity === 'high').length;

      this.auditResults.categories.dataProtection.score = Math.max(0, 100 - (criticalIssues * 30) - (highIssues * 15));

      console.log(`   Data Protection Score: ${this.auditResults.categories.dataProtection.score}/100`);

    } catch (error) {
      console.log('   ⚠️ Could not complete data protection audit:', error.message);
      this.auditResults.categories.dataProtection.score = 50;
    }
  }

  async auditAuthentication() {
    console.log('🔐 Auditing Authentication...');

    try {
      const authFiles = this.getAllCodeFiles().filter(file => 
        file.includes('auth') || file.includes('login') || file.includes('jwt')
      );

      const authChecks = [
        {
          description: 'JWT secret configuration',
          pattern: /JWT_SECRET/,
          severity: 'critical'
        },
        {
          description: 'Password hashing',
          pattern: /bcrypt|scrypt|argon2/,
          severity: 'critical'
        },
        {
          description: 'Rate limiting',
          pattern: /rate.*limit|express-rate-limit/,
          severity: 'high'
        },
        {
          description: 'Session security',
          pattern: /secure.*cookie|httpOnly/,
          severity: 'high'
        }
      ];

      authChecks.forEach(check => {
        const found = authFiles.some(file => {
          const content = fs.readFileSync(file, 'utf8');
          return check.pattern.test(content);
        });

        if (!found) {
          const issue = {
            type: 'authentication',
            severity: check.severity,
            description: `Missing or incomplete: ${check.description}`,
            recommendation: `Implement proper ${check.description}`
          };

          this.auditResults.categories.authentication.issues.push(issue);
        }
      });

      // Calculate score
      const criticalIssues = this.auditResults.categories.authentication.issues
        .filter(i => i.severity === 'critical').length;
      const highIssues = this.auditResults.categories.authentication.issues
        .filter(i => i.severity === 'high').length;

      this.auditResults.categories.authentication.score = Math.max(0, 100 - (criticalIssues * 25) - (highIssues * 15));

      console.log(`   Authentication Score: ${this.auditResults.categories.authentication.score}/100`);

    } catch (error) {
      console.log('   ⚠️ Could not complete authentication audit:', error.message);
      this.auditResults.categories.authentication.score = 50;
    }
  }

  async auditEncryption() {
    console.log('🔒 Auditing Encryption...');

    try {
      const encryptionChecks = [
        {
          description: 'HTTPS enforcement',
          pattern: /helmet|hsts|secure.*header/i,
          severity: 'critical'
        },
        {
          description: 'Data encryption in transit',
          pattern: /TLS|SSL|https/i,
          severity: 'critical'
        },
        {
          description: 'File encryption',
          pattern: /encrypt.*file|crypto.*stream/i,
          severity: 'high'
        },
        {
          description: 'Database encryption',
          pattern: /encrypt.*database|encrypted.*storage/i,
          severity: 'high'
        }
      ];

      const allFiles = this.getAllCodeFiles();

      encryptionChecks.forEach(check => {
        const found = allFiles.some(file => {
          const content = fs.readFileSync(file, 'utf8');
          return check.pattern.test(content);
        });

        if (!found) {
          const issue = {
            type: 'encryption',
            severity: check.severity,
            description: `Missing or incomplete: ${check.description}`,
            recommendation: `Implement ${check.description}`
          };

          this.auditResults.categories.encryption.issues.push(issue);
        }
      });

      // Calculate score
      const criticalIssues = this.auditResults.categories.encryption.issues
        .filter(i => i.severity === 'critical').length;
      const highIssues = this.auditResults.categories.encryption.issues
        .filter(i => i.severity === 'high').length;

      this.auditResults.categories.encryption.score = Math.max(0, 100 - (criticalIssues * 30) - (highIssues * 15));

      console.log(`   Encryption Score: ${this.auditResults.categories.encryption.score}/100`);

    } catch (error) {
      console.log('   ⚠️ Could not complete encryption audit:', error.message);
      this.auditResults.categories.encryption.score = 50;
    }
  }

  async auditCompliance() {
    console.log('📋 Auditing Compliance...');

    try {
      const complianceChecks = [
        {
          description: 'GDPR compliance documentation',
          check: () => fs.existsSync('docs/gdpr-compliance.md'),
          severity: 'high'
        },
        {
          description: 'Terms of service',
          check: () => fs.existsSync('docs/terms-of-service.md'),
          severity: 'medium'
        },
        {
          description: 'Security policy',
          check: () => fs.existsSync('docs/security-policy.md'),
          severity: 'medium'
        },
        {
          description: 'Audit logging',
          check: () => {
            const files = this.getAllCodeFiles();
            return files.some(file => {
              const content = fs.readFileSync(file, 'utf8');
              return content.includes('audit') && content.includes('log');
            });
          },
          severity: 'high'
        },
        {
          description: 'Data processing records',
          check: () => {
            const files = this.getAllCodeFiles();
            return files.some(file => {
              const content = fs.readFileSync(file, 'utf8');
              return content.includes('processing') && content.includes('record');
            });
          },
          severity: 'medium'
        }
      ];

      complianceChecks.forEach(check => {
        if (!check.check()) {
          const issue = {
            type: 'compliance',
            severity: check.severity,
            description: `Missing: ${check.description}`,
            recommendation: `Create or implement ${check.description}`
          };

          this.auditResults.categories.compliance.issues.push(issue);
        }
      });

      // Calculate score
      const highIssues = this.auditResults.categories.compliance.issues
        .filter(i => i.severity === 'high').length;
      const mediumIssues = this.auditResults.categories.compliance.issues
        .filter(i => i.severity === 'medium').length;

      this.auditResults.categories.compliance.score = Math.max(0, 100 - (highIssues * 20) - (mediumIssues * 10));

      console.log(`   Compliance Score: ${this.auditResults.categories.compliance.score}/100`);

    } catch (error) {
      console.log('   ⚠️ Could not complete compliance audit:', error.message);
      this.auditResults.categories.compliance.score = 50;
    }
  }

  calculateOverallScore() {
    const scores = Object.values(this.auditResults.categories).map(cat => cat.score);
    this.auditResults.overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

    // Calculate issue summary
    Object.values(this.auditResults.categories).forEach(category => {
      category.issues.forEach(issue => {
        this.auditResults.summary.totalIssues++;
        
        switch (issue.severity) {
          case 'critical':
            this.auditResults.summary.criticalIssues++;
            break;
          case 'high':
            this.auditResults.summary.highIssues++;
            break;
          case 'medium':
            this.auditResults.summary.mediumIssues++;
            break;
          case 'low':
            this.auditResults.summary.lowIssues++;
            break;
        }
      });
    });
  }

  async generateReport() {
    console.log('\n📊 Security Audit Report');
    console.log('========================');
    console.log(`Overall Security Score: ${this.auditResults.overallScore}/100`);
    console.log(`Total Issues: ${this.auditResults.summary.totalIssues}`);
    console.log(`Critical: ${this.auditResults.summary.criticalIssues}`);
    console.log(`High: ${this.auditResults.summary.highIssues}`);
    console.log(`Medium: ${this.auditResults.summary.mediumIssues}`);
    console.log(`Low: ${this.auditResults.summary.lowIssues}`);

    // Category breakdown
    console.log('\n📋 Category Scores:');
    Object.entries(this.auditResults.categories).forEach(([name, category]) => {
      const status = category.score >= 80 ? '✅' : category.score >= 60 ? '⚠️' : '❌';
      console.log(`${status} ${name}: ${category.score}/100 (${category.issues.length} issues)`);
    });

    // Critical and high issues
    const criticalAndHighIssues = [];
    Object.values(this.auditResults.categories).forEach(category => {
      category.issues.forEach(issue => {
        if (issue.severity === 'critical' || issue.severity === 'high') {
          criticalAndHighIssues.push(issue);
        }
      });
    });

    if (criticalAndHighIssues.length > 0) {
      console.log('\n🚨 Critical and High Priority Issues:');
      criticalAndHighIssues.forEach((issue, index) => {
        const icon = issue.severity === 'critical' ? '🔴' : '🟠';
        console.log(`${icon} ${index + 1}. ${issue.description}`);
        console.log(`   Recommendation: ${issue.recommendation}`);
      });
    }

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'test-reports', 'security-audit.json');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(this.auditResults, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  getAllCodeFiles() {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

    const scanDirectory = (dir) => {
      if (excludeDirs.some(exclude => dir.includes(exclude))) {
        return;
      }

      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (extensions.some(ext => item.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    scanDirectory(process.cwd());
    return files;
  }

  async runCommand(command) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { stdio: 'pipe' });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed: ${command}\n${stderr}`));
        }
      });
    });
  }
}

// Run audit if this script is executed directly
if (require.main === module) {
  const audit = new SecurityAudit();
  audit.runAudit().catch(error => {
    console.error('Security audit failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityAudit;