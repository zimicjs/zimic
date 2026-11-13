import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

function RequirementBadge({ children }: Props) {
  return (
    <span className="border-primary-500/20 bg-primary-500/10 dark:bg-primary-500/20 rounded-full border px-3 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
      {children}
    </span>
  );
}

export default RequirementBadge;
