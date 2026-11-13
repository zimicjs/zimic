import Link from '@docusaurus/Link';

import { cn } from '@/utils/styles';

import { PackageInfo } from './packages';

interface Props {
  package: PackageInfo;
  className?: string;
}

function PackageDetails({ package: packageInfo, className }: Props) {
  return (
    <div className={cn('flex flex-col items-start gap-6 text-left', className)}>
      <div className="flex flex-col gap-2">
        <p className="text-primary-600 dark:text-primary-300 mb-0 font-mono text-sm font-semibold">
          {packageInfo.name}
        </p>
        <h3 className="dark:text-white-light mb-0 text-2xl font-bold text-slate-900">{packageInfo.summary}</h3>
      </div>

      <p className="mb-0 text-base text-slate-600 dark:text-slate-300">{packageInfo.description}</p>

      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {packageInfo.features.map((feature) => (
          <li key={feature.title} className="border-primary-500/40 m-0 border-l-2 pl-4">
            <strong className="dark:text-white-light block text-slate-900">{feature.title}</strong>
            <span className="text-slate-600 dark:text-slate-300">{feature.description}</span>
          </li>
        ))}
      </ul>

      {packageInfo.href ? (
        <Link href={packageInfo.href} className="inline-block font-semibold">
          Read the {packageInfo.name} docs
        </Link>
      ) : (
        <p className="mb-0 text-sm text-slate-500 dark:text-slate-400">Documentation is on the way.</p>
      )}
    </div>
  );
}

export default PackageDetails;
