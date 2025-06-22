import { HttpSchemaPath } from '@zimic/http';
import { FastifyInstance } from 'fastify';
import { renderToStaticMarkup } from 'react-dom/server';

import github from '@/api/clients/github/GitHubClient';
import Sponsors from '@/pages/components/Sponsors';

import { ServerSchema } from '../../schema';
import { CACHE_CONTROL_HEADER, groupSponsorsByTier } from '../get';

function getSponsorsSvgController(app: FastifyInstance) {
  const path = '/api/sponsors/svg' satisfies HttpSchemaPath<ServerSchema>;
  type Endpoint = ServerSchema[typeof path]['GET'];

  app.get(path, async (_request, reply) => {
    const githubSponsorships = await github.listAllOrganizationSponsorships('zimicjs');
    const tiers = groupSponsorsByTier(githubSponsorships);

    const svgAsString = renderToStaticMarkup(<Sponsors tiers={tiers} />);
    const svg = new Blob([svgAsString], { type: 'image/svg' });

    return reply
      .status(200 satisfies keyof Endpoint['response'])
      .header(
        'content-type' satisfies keyof Endpoint['response']['200']['headers'],
        'image/svg' satisfies Endpoint['response']['200']['headers']['content-type'],
      )
      .header(
        'cache-control' satisfies keyof Endpoint['response']['200']['headers'],
        CACHE_CONTROL_HEADER satisfies Endpoint['response']['200']['headers']['cache-control'],
      )
      .send(svg satisfies Endpoint['response']['200']['body']);
  });
}

export default getSponsorsSvgController;
