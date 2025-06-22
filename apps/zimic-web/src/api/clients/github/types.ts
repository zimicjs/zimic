export interface GitHubSponsor {
  name: string;
  login: string;
  avatarUrl: string;
  websiteUrl?: string;
}

export interface GitHubSponsorshipTier {
  id: string;
  name: string;
  monthlyPriceInCents: number;
  isOneTime: boolean;
}

export interface GitHubSponsorship {
  sponsorEntity: GitHubSponsor;
  tier: GitHubSponsorshipTier | null;
  isActive: boolean;
  createdAt: string;
}
