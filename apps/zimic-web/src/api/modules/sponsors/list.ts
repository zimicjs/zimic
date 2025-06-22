import { FastifyInstance } from 'fastify';

import github from '@/api/clients/github/GitHubClient';
import { GitHubSponsorship, GitHubSponsorshipTier } from '@/api/clients/github/types';
import { environment } from '@/config/environment';

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

function groupSponsorsByTier(githubSponsorships: GitHubSponsorship[]) {
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
  app.get('/sponsors', async (_request, reply) => {
    const githubSponsorships = await github.listAllOrganizationSponsorships('zimicjs');
    const tiers = groupSponsorsByTier(githubSponsorships);

    return reply
      .header(
        'cache-control',
        environment.NODE_ENV === 'production'
          ? `public, max-age=${60 * 60 * 24}, s-maxage=${60 * 60 * 24}, stale-while-revalidate=${60 * 5}`
          : undefined,
      )
      .send(tiers);
  });
}

export default listSponsorsController;
