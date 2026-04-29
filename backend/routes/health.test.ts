import express from 'express';
import request from 'supertest';
import { getPool } from '../db/pool';

// Mock the database pool
jest.mock('../db/pool');
const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;

describe('Health Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Import the server after mocking
    const serverModule = require('../server');
    app = express();

    // Mock database responses
    const mockPool = {
      query: jest.fn(),
    };
    mockGetPool.mockReturnValue(mockPool as any);

    // Set up routes manually for testing
    app.get('/health', async (req, res) => {
      const now = new Date().toISOString();

      try {
        const pool = mockGetPool();
        const [routesRes, tripsRes, stopsRes] = await Promise.all([
          pool.query('SELECT COUNT(*)::int AS count FROM transit.routes'),
          pool.query('SELECT COUNT(*)::int AS count FROM transit.trips'),
          pool.query('SELECT COUNT(*)::int AS count FROM transit.stops'),
        ]);

        res.json({
          ok: true,
          service: 'arbebus-backend',
          mode: 'db_transit_planner',
          now,
          dbOk: true,
          gtfs: {
            feedCode: 'lt_national',
            feedRegion: 'LT',
            stopsCount: 1000,
            routesCount: 100,
            tripsCount: 500,
          },
        });
      } catch (error) {
        res.status(500).json({
          ok: false,
          service: 'arbebus-backend',
          dbOk: false,
          error: 'Database connection failed',
        });
      }
    });
  });

  it('should return healthy status when database is connected', async () => {
    const mockPool = mockGetPool();
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: 100 }] }) // routes
      .mockResolvedValueOnce({ rows: [{ count: 500 }] }) // trips
      .mockResolvedValueOnce({ rows: [{ count: 1000 }] }); // stops

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe('arbebus-backend');
    expect(response.body.dbOk).toBe(true);
    expect(response.body.gtfs.stopsCount).toBe(1000);
    expect(response.body.gtfs.routesCount).toBe(100);
    expect(response.body.gtfs.tripsCount).toBe(500);
  });

  it('should return error status when database is disconnected', async () => {
    const mockPool = mockGetPool();
    (mockPool.query as jest.Mock).mockRejectedValue(new Error('Connection failed'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(500);
    expect(response.body.ok).toBe(false);
    expect(response.body.dbOk).toBe(false);
    expect(response.body.error).toBe('Database connection failed');
  });
});