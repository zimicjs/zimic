import { useQuery } from '@tanstack/react-query';
import { createFetch } from '@zimic/fetch';
import { HttpSchema } from '@zimic/http';

const GITHUB_ORGANIZATION = 'zimicjs';
const GITHUB_REPOSITORY = 'zimic';
const GITHUB_SPONSORS_IMAGE_REF = 'canary';
const GITHUB_SPONSORS_IMAGE_PATH = ['apps', 'zimic-web', 'public', 'images', 'sponsors.svg'].join('/');

type JSDelivrSchema = HttpSchema<{
  '/gh/:owner/:repository/:path': {
    GET: {
      response: {
        200: { body: string };
        404: { body: string };
        500: { body: string };
      };
    };
  };
}>;

const jsdelivrFetch = createFetch<JSDelivrSchema>({
  baseURL: 'https://cdn.jsdelivr.net',
});

const queryKey = {
  all() {
    return ['sponsors-image'];
  },
};

function useSponsorsImage() {
  const {
    data: sponsorsImage = '',
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKey.all(),
    async queryFn() {
      const response = await jsdelivrFetch(
        `/gh/${GITHUB_ORGANIZATION}/${GITHUB_REPOSITORY}@${GITHUB_SPONSORS_IMAGE_REF}/${GITHUB_SPONSORS_IMAGE_PATH}`,
        { method: 'GET' },
      );

      if (!response.ok) {
        throw response.error;
      }

      const image = await response.text();
      return image;
    },
  });

  return {
    sponsorsImage,
    isLoadingSponsorsImage: isLoading,
    isErrorSponsorsImage: isError,
  };
}

export default useSponsorsImage;
