import { SponsorshipTier } from '@/api/modules/schema';

interface Props {
  tiers: SponsorshipTier[];
}

function Sponsors({ tiers }: Props) {
  return <div>{tiers.length}</div>;
}

export default Sponsors;
