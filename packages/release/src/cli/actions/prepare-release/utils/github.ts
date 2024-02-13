import { ReleaseConfig } from '@/config/release-config';

function getGitHubRepositoryURL(repositoryOwner: string, repositoryName: string) {
  return `https://github.com/${repositoryOwner}/${repositoryName}`;
}

export function getGitHubPullRequestURL(releaseBranch: string, upgradedVersion: string, config: ReleaseConfig) {
  const pullRequestTitle = `chore(release): v${upgradedVersion}`;
  const repositoryURL = getGitHubRepositoryURL(config.github.repositoryOwner, config.github.repositoryName);

  return `${repositoryURL}/compare/${config.github.productionBranch}...${encodeURIComponent(
    releaseBranch,
  )}?title=${encodeURIComponent(pullRequestTitle)}&expand=1`;
}
