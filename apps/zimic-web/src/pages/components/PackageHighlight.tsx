import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
}

function PackageHighlight({ icon, title, description }: Props) {
  return (
    <div className="flex items-start space-x-3">
      <div className="text-primary-600 dark:text-primary-400 h-6 w-6 shrink-0">{icon}</div>
      <div className="space-y-1">
        <h4 className="dark:text-white-light mb-0 text-base font-semibold text-slate-900">{title}</h4>
        <p className="mb-0 text-sm text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </div>
  );
}

export default PackageHighlight;
