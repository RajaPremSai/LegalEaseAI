#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Verifies that the deployed application is working correctly
 */

const https = require('https');
const http = require('http');

// Configuration
const config = {
  frontend: {
    url: process.env.FRONTEND_URL || 'https://legal-ai-frontend-hash-uc.a.run.app',
    timeout: 30000,
  },
  backend: {
    url: process.env.BACKEND_URL || 'https://legal-ai-backend-hash-uc.a.run.app',
    timeout: 30000,
  },
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData,
            rawData: data,
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: null,
            rawData: data,
          });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test functions
async function testHealthEndpoint(serviceName, url) {
  logInfo(`Testing ${serviceName} health endpoint...`);
  
  try {
    const response = await makeRequest(`${url}/health`, {
      timeout: config[serviceName.toLowerCase()].timeout,
    });
    
    if (response.statusCode === 200) {
      logSuccess(`${serviceName} health check passed`);
      
      if (response.data) {
        logInfo(`  Status: ${response.data.status}`);
        logInfo(`  Uptime: ${response.data.uptime}s`);
        if (response.data.memory) {
          logInfo(`  Memory: ${response.data.memory.used}MB / ${response.data.memory.total}MB (${response.data.memory.percentage}%)`);
        }
      }
      
      return true;
    } else {
      logError(`${serviceName} health check failed with status ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`${serviceName} health check failed: ${error.message}`);
    return false;
  }
}

async function testApiEndpoints(baseUrl) {
  logInfo('Testing API endpoints...');
  
  const endpoints = [
    { path: '/api', method: 'GET', expectedStatus: 200 },
    { path: '/api/auth', method: 'GET', expectedStatus: [200, 404] }, // May not exist
    { path: '/api/documents', method: 'GET', expectedStatus: [200, 401] }, // May require auth
  ];
  
  let passedTests = 0;
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        timeout: 10000,
      });
      
      const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
        ? endpoint.expectedStatus 
        : [endpoint.expectedStatus];
      
      if (expectedStatuses.includes(response.statusCode)) {
        logSuccess(`  ${endpoint.method} ${endpoint.path} - Status: ${response.statusCode}`);
        passedTests++;
      } else {
        logWarning(`  ${endpoint.method} ${endpoint.path} - Unexpected status: ${response.statusCode}`);
      }
    } catch (error) {
      logError(`  ${endpoint.method} ${endpoint.path} - Error: ${error.message}`);
    }
  }
  
  return passedTests;
}

async function testPerformance(serviceName, url) {
  logInfo(`Testing ${serviceName} performance...`);
  
  const iterations = 5;
  const responseTimes = [];
  
  for (let i = 0; i < iterations; i++) {
    try {
      const startTime = Date.now();
      const response = await makeRequest(`${url}/health`);
      const endTime = Date.now();
      
      if (response.statusCode === 200) {
        responseTimes.push(endTime - startTime);
      }
    } catch (error) {
      logWarning(`  Performance test iteration ${i + 1} failed: ${error.message}`);
    }
  }
  
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    logInfo(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
    logInfo(`  Min response time: ${minResponseTime}ms`);
    logInfo(`  Max response time: ${maxResponseTime}ms`);
    
    if (avgResponseTime < 1000) {
      logSuccess(`  ${serviceName} performance is good (< 1s)`);
      return true;
    } else if (avgResponseTime < 3000) {
      logWarning(`  ${serviceName} performance is acceptable (< 3s)`);
      return true;
    } else {
      logError(`  ${serviceName} performance is poor (> 3s)`);
      return false;
    }
  } else {
    logError(`  ${serviceName} performance test failed - no successful requests`);
    return false;
  }
}

async function testSecurity(url) {
  logInfo('Testing security headers...');
  
  try {
    const response = await makeRequest(url);
    const headers = response.headers;
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
    ];
    
    let securityScore = 0;
    
    for (const header of securityHeaders) {
      if (headers[header]) {
        logSuccess(`  ${header}: ${headers[header]}`);
        securityScore++;
      } else {
        logWarning(`  Missing security header: ${header}`);
      }
    }
    
    if (headers['strict-transport-security']) {
      logSuccess(`  strict-transport-security: ${headers['strict-transport-security']}`);
      securityScore++;
    } else {
      logWarning('  Missing HSTS header');
    }
    
    const securityPercentage = (securityScore / (securityHeaders.length + 1)) * 100;
    logInfo(`  Security score: ${securityScore}/${securityHeaders.length + 1} (${securityPercentage.toFixed(0)}%)`);
    
    return securityPercentage >= 75;
  } catch (error) {
    logError(`Security test failed: ${error.message}`);
    return false;
  }
}

// Main verification function
async function verifyDeployment() {
  logInfo('🚀 Starting deployment verification...\n');
  
  const results = {
    backend: {
      health: false,
      api: 0,
      performance: false,
      security: false,
    },
    frontend: {
      health: false,
      performance: false,
      security: false,
    },
  };
  
  // Test Backend
  log('\n📡 Testing Backend Service', colors.blue);
  log('=' .repeat(50), colors.blue);
  
  results.backend.health = await testHealthEndpoint('Backend', config.backend.url);
  results.backend.api = await testApiEndpoints(config.backend.url);
  results.backend.performance = await testPerformance('Backend', config.backend.url);
  results.backend.security = await testSecurity(config.backend.url);
  
  // Test Frontend
  log('\n🌐 Testing Frontend Service', colors.blue);
  log('=' .repeat(50), colors.blue);
  
  results.frontend.health = await testHealthEndpoint('Frontend', config.frontend.url);
  results.frontend.performance = await testPerformance('Frontend', config.frontend.url);
  results.frontend.security = await testSecurity(config.frontend.url);
  
  // Summary
  log('\n📊 Verification Summary', colors.blue);
  log('=' .repeat(50), colors.blue);
  
  const backendScore = Object.values(results.backend).filter(Boolean).length;
  const frontendScore = Object.values(results.frontend).filter(Boolean).length;
  const totalTests = Object.keys(results.backend).length + Object.keys(results.frontend).length;
  const totalPassed = backendScore + frontendScore;
  
  logInfo(`Backend: ${backendScore}/4 tests passed`);
  logInfo(`Frontend: ${frontendScore}/3 tests passed`);
  logInfo(`Overall: ${totalPassed}/${totalTests} tests passed`);
  
  const successRate = (totalPassed / totalTests) * 100;
  
  if (successRate >= 90) {
    logSuccess(`\n🎉 Deployment verification PASSED (${successRate.toFixed(0)}%)`);
    process.exit(0);
  } else if (successRate >= 70) {
    logWarning(`\n⚠️  Deployment verification PASSED with warnings (${successRate.toFixed(0)}%)`);
    process.exit(0);
  } else {
    logError(`\n💥 Deployment verification FAILED (${successRate.toFixed(0)}%)`);
    process.exit(1);
  }
}

// Run verification
if (require.main === module) {
  verifyDeployment().catch((error) => {
    logError(`Verification failed with error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { verifyDeployment };