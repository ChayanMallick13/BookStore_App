process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/bookhaven_test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters!';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec';
