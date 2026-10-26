import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BookHaven API',
      version: '1.0.0',
      description: 'REST API for BookHaven bookstore',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'bookhaven_access' },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
});
