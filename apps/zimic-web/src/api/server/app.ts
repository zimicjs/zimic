import cors from '@fastify/cors';
import fastify from 'fastify';

import { environment } from '@/config/environment';

import listSponsorsController from '../modules/sponsors/get';
import getSponsorsSvgController from '../modules/sponsors/svg/get';
import { handleServerError } from './errors';

const app = fastify({
  logger: environment.NODE_ENV !== 'test',
  disableRequestLogging: environment.NODE_ENV === 'development',
  pluginTimeout: 0,
});

app
  .register(cors, { origin: environment.API_CORS_ORIGIN })
  .register(listSponsorsController)
  .register(getSponsorsSvgController)
  .setErrorHandler(handleServerError);

export default app;
