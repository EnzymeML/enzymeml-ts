// Global test setup for Jest
// This file runs before all tests

// Extend Jest matchers if needed
import 'jest';

// Global mock for console methods to avoid spam in test output
global.console = {
    ...console,
    // Uncomment the following lines to suppress console output during tests
    // log: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
    // info: jest.fn(),
    // debug: jest.fn(),
};

// Mock timers for tests that need them
// jest.useFakeTimers();

// Set test timeout
jest.setTimeout(10000);

// Setup global test environment
beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
});

afterEach(() => {
    // Cleanup after each test
    jest.restoreAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Suppress specific warnings during testing
const originalWarn = console.warn;
console.warn = (...args) => {
    // Suppress known warnings that are not relevant to tests
    if (
        args[0] &&
        typeof args[0] === 'string' &&
        (args[0].includes('deprecated') || args[0].includes('experimental'))
    ) {
        return;
    }
    originalWarn.apply(console, args);
}; 