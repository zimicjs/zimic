import { HttpSchemaPath } from '@zimic/http';
import { FastifyInstance } from 'fastify';

import github from '@/api/clients/github/GitHubClient';
import { GitHubSponsorship, GitHubSponsorshipTier } from '@/api/clients/github/types';
import { environment } from '@/config/environment';

import { ServerSchema } from '../schema';

export const CACHE_CONTROL_HEADER =
  environment.NODE_ENV === 'production'
    ? `public, max-age=${60 * 60 * 24}, s-maxage=${60 * 60 * 24}, stale-while-revalidate=${60 * 5}`
    : undefined;

interface Sponsor {
  name: string;
  avatar: string;
  url: string;
}

interface SponsorshipTier {
  id: string;
  name: string;
  sponsors: Sponsor[];
}

export function groupSponsorsByTier(githubSponsorships: GitHubSponsorship[]) {
  const activeGitHubSponsorshipsByTierId = new Map<GitHubSponsorshipTier['id'], GitHubSponsorship[]>();
  const githubTierById = new Map<GitHubSponsorshipTier['id'], GitHubSponsorshipTier>();

  for (const sponsorship of githubSponsorships) {
    if (!sponsorship.tier) {
      continue;
    }

    const tierSponsorships = activeGitHubSponsorshipsByTierId.get(sponsorship.tier.id);

    if (tierSponsorships) {
      tierSponsorships.push(sponsorship);
    } else {
      activeGitHubSponsorshipsByTierId.set(sponsorship.tier.id, [sponsorship]);
    }

    if (!githubTierById.has(sponsorship.tier.id)) {
      githubTierById.set(sponsorship.tier.id, sponsorship.tier);
    }
  }

  const githubTiers = Array.from(githubTierById.values()).sort(
    (tier, otherTier) => otherTier.monthlyPriceInCents - tier.monthlyPriceInCents,
  );

  const tiers = githubTiers.map((githubTier): SponsorshipTier => {
    const githubSponsors = activeGitHubSponsorshipsByTierId.get(githubTier.id) ?? [];
    const sponsors = githubSponsors.map(({ sponsorEntity: githubSponsor }): Sponsor => {
      return {
        name: githubSponsor.name,
        avatar: githubSponsor.avatarUrl,
        url: githubSponsor.websiteUrl ?? `https://github.com/${encodeURIComponent(githubSponsor.login)}`,
      };
    });

    return {
      id: githubTier.id,
      name: githubTier.name,
      sponsors,
    };
  });

  return tiers;
}

function listSponsorsController(app: FastifyInstance) {
  const path = '/api/sponsors/tiers' satisfies HttpSchemaPath<ServerSchema>;
  type Endpoint = ServerSchema[typeof path]['GET'];

  app.get(path, async (_request, reply) => {
    const githubSponsorships = await github.listAllOrganizationSponsorships('zimicjs');
    const tiers = groupSponsorsByTier(githubSponsorships);

    return reply
      .status(200 satisfies keyof Endpoint['response'])
      .header(
        'cache-control' satisfies keyof Endpoint['response']['200']['headers'],
        CACHE_CONTROL_HEADER satisfies Endpoint['response']['200']['headers']['cache-control'],
      )
      .send(tiers satisfies Endpoint['response']['200']['body']);
  });
}

export default listSponsorsController;
