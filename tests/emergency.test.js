const request = require('supertest');
const app = require('../src/app');

describe('Emergency API Endpoints', () => {

  describe('GET /health', () => {
    it('should return health status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('POST /api/v1/emergency - Input Validation', () => {
    it('should reject request missing user_id with 400', async () => {
      const res = await request(app)
        .post('/api/v1/emergency')
        .send({ location: 'MG Road', description: 'Car crash with injuries' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('user_id');
    });

    it('should reject short description with 400', async () => {
      const res = await request(app)
        .post('/api/v1/emergency')
        .send({ user_id: 1, location: 'MG Road', description: 'Help' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('at least 10 characters');
    });

    it('should reject short location with 400', async () => {
      const res = await request(app)
        .post('/api/v1/emergency')
        .send({ user_id: 1, location: 'A', description: 'Car accident on main street' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/emergency/status - Input Validation', () => {
    it('should reject invalid status value with 400', async () => {
      const res = await request(app)
        .put('/api/v1/emergency/status')
        .send({ request_id: 1, status: 'INVALID_STATUS' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

});
