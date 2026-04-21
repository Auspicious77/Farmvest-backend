const request = require('supertest');
const app = require('../server'); // Assuming server.js exports the Express app

describe('Investment API Endpoints', () => {
  let token;

  beforeAll(async () => {
    // Authenticate and get a token for protected routes
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@example.com', password: 'password123' });

    token = res.body.token;
  });

  test('GET /api/investments - Fetch user investments', async () => {
    const res = await request(app)
      .get('/api/investments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.investments)).toBe(true);
  });

  test('POST /api/investments - Create a new investment', async () => {
    const res = await request(app)
      .post('/api/investments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 'product123',
        amount: 10000,
        pin: '123456',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.investment).toHaveProperty('_id');
  });

  test('GET /api/investments/:id - Fetch investment by ID', async () => {
    const investmentId = 'investment123';
    const res = await request(app)
      .get(`/api/investments/${investmentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.investment).toHaveProperty('_id', investmentId);
  });
});