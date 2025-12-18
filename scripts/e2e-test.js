#!/usr/bin/env node

/**
 * End-to-End Test Script for Pollis
 * 
 * This script:
 * 1. Sets up temporary data directories for two test users
 * 2. Starts the gRPC service in the background
 * 3. Runs Go E2E tests
 * 4. Cleans up all test assets on exit (success or failure)
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const TEST_BASE_DIR = path.join(os.tmpdir(), 'pollis-e2e-test');
const USER1_DATA_DIR = path.join(TEST_BASE_DIR, 'user1');
const USER2_DATA_DIR = path.join(TEST_BASE_DIR, 'user2');
const SERVICE_DATA_DIR = path.join(TEST_BASE_DIR, 'service');
const SERVICE_PORT = '50051';
const SERVICE_URL = `localhost:${SERVICE_PORT}`;
const SERVICE_DB_PATH = path.join(SERVICE_DATA_DIR, 'pollis-service.db');

// Process tracking
let serviceProcess = null;
let cleanupCalled = false;

/**
 * Cleanup function - removes all test directories and kills processes
 */
function cleanup() {
  if (cleanupCalled) {
    return;
  }
  cleanupCalled = true;

  console.log('\n🧹 Cleaning up test assets...');

  // Kill service process if running
  if (serviceProcess) {
    console.log('   Stopping service...');
    try {
      serviceProcess.kill('SIGTERM');
      // Give it a moment to shut down gracefully
      setTimeout(() => {
        if (serviceProcess && !serviceProcess.killed) {
          serviceProcess.kill('SIGKILL');
        }
      }, 2000);
    } catch (err) {
      console.error('   Error stopping service:', err.message);
    }
  }

  // Remove test directories
  const dirsToRemove = [TEST_BASE_DIR];
  for (const dir of dirsToRemove) {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`   Removed: ${dir}`);
      } catch (err) {
        console.error(`   Error removing ${dir}:`, err.message);
      }
    }
  }

  console.log('✅ Cleanup complete');
}

// Register cleanup handlers
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT, cleaning up...');
  cleanup();
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Received SIGTERM, cleaning up...');
  cleanup();
  process.exit(143);
});

process.on('exit', (code) => {
  cleanup();
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  cleanup();
  process.exit(1);
});

/**
 * Start the gRPC service
 */
function startService() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting gRPC service...');
    console.log(`   Data directory: ${SERVICE_DATA_DIR}`);
    console.log(`   Port: ${SERVICE_PORT}`);

    // Ensure service data directory exists
    if (!fs.existsSync(SERVICE_DATA_DIR)) {
      fs.mkdirSync(SERVICE_DATA_DIR, { recursive: true });
    }

    // Build service if needed
    const serviceDir = path.join(__dirname, '..', 'service');
    const serviceBin = path.join(serviceDir, 'bin', 'server');

    // Check if service binary exists, if not, build it
    if (!fs.existsSync(serviceBin)) {
      console.log('   Building service...');
      const buildProcess = spawn('make', ['build'], {
        cwd: serviceDir,
        stdio: 'inherit',
        shell: true,
      });

      buildProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Service build failed with code ${code}`));
          return;
        }
        runService();
      });
    } else {
      runService();
    }

    function runService() {
      const dbURL = `libsql://file:${SERVICE_DB_PATH}`;
      serviceProcess = spawn(serviceBin, [
        '-port', SERVICE_PORT,
        '-db', dbURL,
      ], {
        cwd: serviceDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
        },
      });

      let serviceOutput = '';
      serviceProcess.stdout.on('data', (data) => {
        const output = data.toString();
        serviceOutput += output;
        // Only show service output if it's an error or important message
        if (output.includes('error') || output.includes('Error') || output.includes('listening')) {
          console.log(`   [SERVICE] ${output.trim()}`);
        }
      });

      serviceProcess.stderr.on('data', (data) => {
        const output = data.toString();
        serviceOutput += output;
        console.error(`   [SERVICE ERROR] ${output.trim()}`);
      });

      serviceProcess.on('error', (err) => {
        reject(new Error(`Failed to start service: ${err.message}`));
      });

      // Wait for service to be ready (check for listening message or wait a bit)
      setTimeout(() => {
        // Check if process is still running
        if (serviceProcess && serviceProcess.pid) {
          console.log('✅ Service started');
          resolve();
        } else {
          reject(new Error('Service process died immediately'));
        }
      }, 2000);
    }
  });
}

/**
 * Run Go E2E tests
 */
function runTests() {
  return new Promise((resolve, reject) => {
    console.log('\n🧪 Running E2E tests...');
    console.log(`   User1 data: ${USER1_DATA_DIR}`);
    console.log(`   User2 data: ${USER2_DATA_DIR}`);
    console.log(`   Service URL: ${SERVICE_URL}`);

    const testEnv = {
      ...process.env,
      E2E_USER1_DATA_DIR: USER1_DATA_DIR,
      E2E_USER2_DATA_DIR: USER2_DATA_DIR,
      E2E_SERVICE_URL: SERVICE_URL,
      XDG_DATA_HOME: USER1_DATA_DIR, // For any Go code that checks this
    };

    const testProcess = spawn('go', ['test', '-v', '-run', '^TestE2E_MultiUser$', '.'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: testEnv,
    });

    testProcess.on('error', (err) => {
      reject(new Error(`Failed to run tests: ${err.message}`));
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ All tests passed!');
        resolve();
      } else {
        reject(new Error(`Tests failed with code ${code}`));
      }
    });
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🧪 Pollis E2E Test Suite');
    console.log('='.repeat(50));

    // Create test directories
    console.log('\n📁 Setting up test directories...');
    [USER1_DATA_DIR, USER2_DATA_DIR, SERVICE_DATA_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`   Created: ${dir}`);
      }
    });

    // Start service
    await startService();

    // Run tests
    await runTests();

    console.log('\n' + '='.repeat(50));
    console.log('✅ E2E test suite completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E test suite failed:', error.message);
    process.exit(1);
  }
}

// Run main
main();

