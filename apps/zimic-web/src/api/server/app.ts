import cors from '@fastify/cors';
import fastify, { FastifyInstance } from 'fastify';

import { environment } from '@/config/environment';

import listSponsorsController from '../modules/sponsors/list';
import { handleServerError } from './errors';

const app = fastify({
  logger: environment.NODE_ENV !== 'test',
  disableRequestLogging: environment.NODE_ENV !== 'development',
  pluginTimeout: 0,
});

function controller(app: FastifyInstance) {
  app.register(listSponsorsController);
}

app
  .register(cors, { origin: environment.API_CORS_ORIGIN })
  .register(controller, { prefix: '/api' })
  .setErrorHandler(handleServerError);

export default app;
