import { Octokit } from '@octokit/core';

import { environment } from '@/config/environment';

import { GitHubSponsorship } from './types';

const DEFAULT_ORGANIZATION_SPONSORSHIPS_PAGE_SIZE = 100;

class GitHubClient {
  private github: Octokit;

  constructor(token: string) {
    this.github = new Octokit({ auth: token });
  }

  async listOrganizationSponsorships(
    organization: string,
    options: {
      cursor?: string;
      size?: number;
    },
  ) {
    const result = await this.github.graphql<{
      organization: {
        sponsorshipsAsMaintainer: {
          nodes: GitHubSponsorship[];
          pageInfo: {
            endCursor: string;
            hasNextPage: boolean;
          };
        };
      };
    }>(
      `query organizationSponsors($organization: String!, $first: Int!, $after: String) {
        organization(login: $organization) {
          sponsorshipsAsMaintainer(activeOnly: true, first: $first, after: $after) {
            nodes {
              tier {
                id
                name
                monthlyPriceInCents
                isOneTime
              }
              sponsorEntity {
                ... on User {
                  name
                  login
                  avatarUrl
                  websiteUrl
                }
                ... on Organization {
                  name
                  avatarUrl
                  websiteUrl
                }
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }`,
      {
        organization,
        first: options.size ?? DEFAULT_ORGANIZATION_SPONSORSHIPS_PAGE_SIZE,
        after: options.cursor ?? null,
      },
    );

    return {
      sponsorships: result.organization.sponsorshipsAsMaintainer.nodes,
      nextCursor: result.organization.sponsorshipsAsMaintainer.pageInfo.endCursor,
      hasNextPage: result.organization.sponsorshipsAsMaintainer.pageInfo.hasNextPage,
    };
  }

  async listAllOrganizationSponsorships(organization: string) {
    const allSponsorships: GitHubSponsorship[] = [];
    let cursor: string | undefined;

    while (true) {
      const { sponsorships, nextCursor, hasNextPage } = await this.listOrganizationSponsorships(organization, {
        cursor,
      });

      for (const sponsorship of sponsorships) {
        allSponsorships.push(sponsorship);
      }

      if (hasNextPage) {
        cursor = nextCursor;
      } else {
        break;
      }
    }

    return allSponsorships;
  }
}

const github = new GitHubClient(environment.API_GITHUB_TOKEN);

export default github;
