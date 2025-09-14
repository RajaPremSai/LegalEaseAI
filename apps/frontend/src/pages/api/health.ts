import { NextApiRequest, NextApiResponse } from 'next';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  checks: {
    api: 'healthy' | 'unhealthy';
    dependencies: 'healthy' | 'unhealthy';
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthStatus>
) {
  const startTime = Date.now();
  
  try {
    // Check API connectivity
    const apiCheck = await checkApiHealth();
    
    // Check dependencies
    const dependencyCheck = await checkDependencies();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    const health: HealthStatus = {
      status: apiCheck && dependencyCheck ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage),
      },
      checks: {
        api: apiCheck ? 'healthy' : 'unhealthy',
        dependencies: dependencyCheck ? 'healthy' : 'unhealthy',
      },
    };
    
    const responseTime = Date.now() - startTime;
    
    // Set response headers
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      checks: {
        api: 'unhealthy',
        dependencies: 'unhealthy',
      },
    });
  }
}

async function checkApiHealth(): Promise<boolean> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return false;
    
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      timeout: 5000,
    });
    
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}

async function checkDependencies(): Promise<boolean> {
  try {
    // Check if critical dependencies are available
    // This could include checking external services, databases, etc.
    
    // For now, just check if the process is running normally
    return process.uptime() > 0;
  } catch (error) {
    console.error('Dependency check failed:', error);
    return false;
  }
}