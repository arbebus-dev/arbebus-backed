import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: './backend/.env.test' });

// Mock external dependencies
jest.mock('../config/env', () => ({
  env: {
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    PORT: 3001,
    HOST: 'localhost',
    GTFS_FEED_CODE: 'test',
    GTFS_FEED_REGION: 'TEST',
    ENABLE_CORS: true,
    CORS_ORIGIN: '*',
  },
}));

// Mock database connections
jest.mock('../db/pool', () => ({
  getPool: () => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  }),
}));

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    exists: jest.fn(),
    ping: jest.fn(),
  }));
});

// Mock external APIs
jest.mock('node-fetch', () => jest.fn());

// Global test utilities
global.testUtils = {
  createMockRequest: (body = {}, query = {}, params = {}) => ({
    body,
    query,
    params,
    headers: {},
    ip: '127.0.0.1',
  }),

  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    return res;
  },

  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};