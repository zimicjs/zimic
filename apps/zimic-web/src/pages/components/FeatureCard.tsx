import { ReactNode } from 'react';

import HighlightCard from './HighlightCard';

interface Props {
  title: string;
  description: string;
  icon?: ReactNode;
}

function FeatureCard({ title, description, icon }: Props) {
  return (
    <HighlightCard>
      <div className="flex items-center space-x-2">
        <div className="text-primary-600 dark:text-primary-400 h-6 w-6">{icon}</div>
        <h3 className="mb-0 text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <p className="mb-0 text-base text-slate-600 dark:text-slate-300">{description}</p>
    </HighlightCard>
  );
}

export default FeatureCard;
