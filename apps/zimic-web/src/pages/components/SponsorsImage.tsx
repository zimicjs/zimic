import LoadingIcon from '@/components/icons/LoadingIcon';
import useSponsorsImage from '@/hooks/useSponsorsImage';
import { sanitizeSvg } from '@/utils/html';

function SponsorsImage() {
  const { sponsorsImage, isLoadingSponsorsImage, isErrorSponsorsImage } = useSponsorsImage();

  const hasEmptySponsors = !sponsorsImage || sponsorsImage.includes('viewBox="0 0 800 40"');

  if (!isLoadingSponsorsImage && !isErrorSponsorsImage && hasEmptySponsors) {
    return null;
  }

  return (
    <div className="flex w-full justify-center text-slate-600 dark:text-slate-300">
      {isLoadingSponsorsImage && <LoadingIcon role="img" title="Loading sponsors..." className="h-6 w-6" />}

      {!isLoadingSponsorsImage && isErrorSponsorsImage && (
        <div className="mb-0 text-center">
          Oops! Could not load sponsors.
          <br />
          Please try again later.
        </div>
      )}

      {!isLoadingSponsorsImage && !isErrorSponsorsImage && !hasEmptySponsors && (
        //  The image is sanitized before being rendered.
        // eslint-disable-next-line react/no-danger
        <div dangerouslySetInnerHTML={{ __html: sanitizeSvg(sponsorsImage) }} className="overflow-x-auto" />
      )}
    </div>
  );
}

export default SponsorsImage;
