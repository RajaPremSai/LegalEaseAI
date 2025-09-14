#!/usr/bin/env node

/**
 * Comprehensive E2E Test Runner
 * Orchestrates all end-to-end testing including setup, execution, and reporting
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class E2ETestRunner {
  constructor() {
    this.testResults = {
      startTime: new Date(),
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      testSuites: [],
      coverage: null,
      performance: {
        averageResponseTime: 0,
        maxResponseTime: 0,
        throughput: 0
      },
      errors: []
    };

    this.config = {
      timeout: 300000, // 5 minutes per test suite
      retries: 2,
      parallel: false, // Set to true for faster execution
      coverage: true,
      browsers: ['chrome', 'firefox', 'safari', 'edge'],
      devices: ['desktop', 'tablet', 'mobile'],
      loadTestLevels: ['light', 'medium', 'heavy']
    };
  }

  async runTests() {
    console.log('🚀 Starting Comprehensive E2E Test Suite');
    console.log('==========================================');
    
    try {
      // Step 1: Environment setup
      await this.setupTestEnvironment();
      
      // Step 2: Start test services
      await this.startTestServices();
      
      // Step 3: Run test suites
      await this.runTestSuites();
      
      // Step 4: Generate reports
      await this.generateReports();
      
      // Step 5: Cleanup
      await this.cleanup();
      
      console.log('✅ All E2E tests completed successfully');
      
    } catch (error) {
      console.error('❌ E2E test execution failed:', error.message);
      this.testResults.errors.push(error.message);
      process.exit(1);
    }
  }

  async setupTestEnvironment() {
    console.log('📋 Setting up test environment...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`Node.js version: ${nodeVersion}`);
    
    // Check available memory
    const totalMemory = os.totalmem() / 1024 / 1024 / 1024;
    console.log(`Available memory: ${totalMemory.toFixed(2)} GB`);
    
    // Install dependencies if needed
    await this.runCommand('npm install', { cwd: process.cwd() });
    
    // Build applications
    console.log('🔨 Building applications...');
    await this.runCommand('npm run build', { cwd: process.cwd() });
    
    // Setup test database
    await this.setupTestDatabase();
    
    // Setup mock services
    await this.setupMockServices();
    
    console.log('✅ Test environment setup complete');
  }

  async setupTestDatabase() {
    console.log('🗄️ Setting up test database...');
    
    // Create test database
    const dbConfig = {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: process.env.TEST_DB_PORT || 5432,
      database: process.env.TEST_DB_NAME || 'legal_ai_test',
      user: process.env.TEST_DB_USER || 'test_user',
      password: process.env.TEST_DB_PASSWORD || 'test_password'
    };
    
    // Run migrations
    await this.runCommand('npm run migrate', { 
      cwd: 'apps/backend',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    // Seed test data
    await this.runCommand('npm run seed:test', { 
      cwd: 'apps/backend',
      env: { ...process.env, NODE_ENV: 'test' }
    });
  }

  async setupMockServices() {
    console.log('🎭 Setting up mock services...');
    
    // Mock Google Cloud services
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '../test-service-account.json');
    
    // Create mock service account file if it doesn't exist
    const mockServiceAccount = {
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'test-key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      client_id: 'test-client-id',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token'
    };
    
    if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      fs.writeFileSync(
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        JSON.stringify(mockServiceAccount, null, 2)
      );
    }
  }

  async startTestServices() {
    console.log('🚀 Starting test services...');
    
    // Start backend server
    this.backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: 'apps/backend',
      env: { ...process.env, NODE_ENV: 'test', PORT: '3001' },
      stdio: 'pipe'
    });
    
    // Start frontend server
    this.frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: 'apps/frontend',
      env: { ...process.env, NODE_ENV: 'test', PORT: '3000' },
      stdio: 'pipe'
    });
    
    // Wait for services to be ready
    await this.waitForService('http://localhost:3001/api/health', 30000);
    await this.waitForService('http://localhost:3000', 30000);
    
    console.log('✅ Test services started');
  }

  async runTestSuites() {
    console.log('🧪 Running test suites...');
    
    const testSuites = [
      {
        name: 'Complete Workflow Tests',
        command: 'npm test -- --testPathPattern=complete-workflow.test.tsx',
        cwd: 'apps/frontend',
        timeout: this.config.timeout
      },
      {
        name: 'AI Accuracy Validation',
        command: 'npm test -- --testPathPattern=ai-accuracy-validation.test.ts',
        cwd: 'apps/backend',
        timeout: this.config.timeout
      },
      {
        name: 'Cross-Browser Compatibility',
        command: 'npm test -- --testPathPattern=cross-browser-compatibility.test.tsx',
        cwd: 'apps/frontend',
        timeout: this.config.timeout
      },
      {
        name: 'Load Testing',
        command: 'npm test -- --testPathPattern=load-testing.test.ts --runInBand',
        cwd: 'apps/backend',
        timeout: this.config.timeout * 2 // Load tests take longer
      },
      {
        name: 'Security Testing',
        command: 'npm test -- --testPathPattern=security',
        cwd: 'apps/backend',
        timeout: this.config.timeout
      },
      {
        name: 'Performance Testing',
        command: 'npm test -- --testPathPattern=performance',
        cwd: 'apps/frontend',
        timeout: this.config.timeout
      },
      {
        name: 'Accessibility Testing',
        command: 'npm test -- --testPathPattern=accessibility',
        cwd: 'apps/frontend',
        timeout: this.config.timeout
      }
    ];

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }
  }

  async runTestSuite(suite) {
    console.log(`\n📝 Running ${suite.name}...`);
    
    const startTime = Date.now();
    let attempt = 0;
    let success = false;
    let lastError = null;

    while (attempt <= this.config.retries && !success) {
      try {
        if (attempt > 0) {
          console.log(`   Retry attempt ${attempt}/${this.config.retries}`);
        }

        const result = await this.runCommand(suite.command, {
          cwd: suite.cwd,
          timeout: suite.timeout
        });

        success = true;
        
        const endTime = Date.now();
        const duration = endTime - startTime;

        const suiteResult = {
          name: suite.name,
          status: 'passed',
          duration,
          attempt: attempt + 1,
          output: result.stdout
        };

        this.testResults.testSuites.push(suiteResult);
        this.testResults.passedTests++;

        console.log(`   ✅ ${suite.name} passed (${duration}ms)`);

      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt <= this.config.retries) {
          console.log(`   ⚠️ ${suite.name} failed, retrying...`);
          await this.sleep(5000); // Wait 5 seconds before retry
        }
      }
    }

    if (!success) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const suiteResult = {
        name: suite.name,
        status: 'failed',
        duration,
        attempt: attempt,
        error: lastError.message,
        output: lastError.stdout || lastError.stderr
      };

      this.testResults.testSuites.push(suiteResult);
      this.testResults.failedTests++;
      this.testResults.errors.push(`${suite.name}: ${lastError.message}`);

      console.log(`   ❌ ${suite.name} failed after ${attempt} attempts`);
      console.log(`   Error: ${lastError.message}`);
    }

    this.testResults.totalTests++;
  }

  async generateReports() {
    console.log('\n📊 Generating test reports...');
    
    this.testResults.endTime = new Date();
    const totalDuration = this.testResults.endTime - this.testResults.startTime;

    // Generate JSON report
    const jsonReport = {
      ...this.testResults,
      totalDuration,
      successRate: (this.testResults.passedTests / this.testResults.totalTests) * 100,
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        memory: os.totalmem(),
        cpus: os.cpus().length
      }
    };

    const reportsDir = path.join(process.cwd(), 'test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(reportsDir, 'e2e-test-results.json'),
      JSON.stringify(jsonReport, null, 2)
    );

    // Generate HTML report
    await this.generateHtmlReport(jsonReport, reportsDir);

    // Generate coverage report if enabled
    if (this.config.coverage) {
      await this.generateCoverageReport(reportsDir);
    }

    // Print summary
    this.printTestSummary(jsonReport);
  }

  async generateHtmlReport(results, reportsDir) {
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>E2E Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .suite { margin: 10px 0; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .suite.failed { border-left-color: #dc3545; }
        .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 3px; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>E2E Test Results</h1>
        <p>Generated: ${results.endTime}</p>
        <p>Duration: ${Math.round(results.totalDuration / 1000)}s</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div style="font-size: 2em;">${results.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div style="font-size: 2em;" class="passed">${results.passedTests}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div style="font-size: 2em;" class="failed">${results.failedTests}</div>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <div style="font-size: 2em;">${results.successRate.toFixed(1)}%</div>
        </div>
    </div>
    
    <h2>Test Suites</h2>
    ${results.testSuites.map(suite => `
        <div class="suite ${suite.status}">
            <h3>${suite.name} - ${suite.status.toUpperCase()}</h3>
            <p>Duration: ${suite.duration}ms | Attempts: ${suite.attempt}</p>
            ${suite.error ? `<div class="error">Error: ${suite.error}</div>` : ''}
        </div>
    `).join('')}
    
    ${results.errors.length > 0 ? `
        <h2>Errors</h2>
        ${results.errors.map(error => `<div class="error">${error}</div>`).join('')}
    ` : ''}
</body>
</html>`;

    fs.writeFileSync(path.join(reportsDir, 'e2e-test-report.html'), htmlTemplate);
  }

  async generateCoverageReport(reportsDir) {
    try {
      await this.runCommand('npm run test:coverage', { cwd: process.cwd() });
      console.log('   ✅ Coverage report generated');
    } catch (error) {
      console.log('   ⚠️ Coverage report generation failed:', error.message);
    }
  }

  printTestSummary(results) {
    console.log('\n📋 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${results.totalTests}`);
    console.log(`Passed: ${results.passedTests} ✅`);
    console.log(`Failed: ${results.failedTests} ❌`);
    console.log(`Success Rate: ${results.successRate.toFixed(1)}%`);
    console.log(`Total Duration: ${Math.round(results.totalDuration / 1000)}s`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    console.log(`\n📊 Reports generated in: test-reports/`);
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    // Stop test services
    if (this.backendProcess) {
      this.backendProcess.kill();
    }
    if (this.frontendProcess) {
      this.frontendProcess.kill();
    }
    
    // Clean up test database
    try {
      await this.runCommand('npm run db:cleanup', { 
        cwd: 'apps/backend',
        env: { ...process.env, NODE_ENV: 'test' }
      });
    } catch (error) {
      console.log('   ⚠️ Database cleanup failed:', error.message);
    }
    
    // Remove temporary files
    const tempFiles = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    ].filter(Boolean);
    
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    
    console.log('✅ Cleanup complete');
  }

  // Utility methods
  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = options.timeout ? setTimeout(() => {
        child.kill();
        reject(new Error(`Command timeout: ${command}`));
      }, options.timeout) : null;

      child.on('close', (code) => {
        if (timeout) clearTimeout(timeout);
        
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Command failed: ${command}`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.code = code;
          reject(error);
        }
      });
    });
  }

  async waitForService(url, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      
      await this.sleep(1000);
    }
    
    throw new Error(`Service not ready: ${url}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const runner = new E2ETestRunner();
  runner.runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = E2ETestRunner;