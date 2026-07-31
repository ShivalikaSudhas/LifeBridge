const request = require('supertest');
const app = require('../src/app');

describe('Dispatch API Endpoints', () => {

  describe('POST /api/v1/dispatch/assign - Input Validation', () => {
    it('should reject assign request missing responder_id with 400', async () => {
      const res = await request(app)
        .post('/api/v1/dispatch/assign')
        .send({ request_id: 1 });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject negative request_id with 400', async () => {
      const res = await request(app)
        .post('/api/v1/dispatch/assign')
        .send({ request_id: -5, responder_id: 1 });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

});
