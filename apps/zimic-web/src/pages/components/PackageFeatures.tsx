import Link from '@docusaurus/Link';

import { PackageInfo } from './packages';

interface Props {
  package: PackageInfo;
}

function PackageFeatures({ package: packageInfo }: Props) {
  return (
    <div className="flex flex-col items-start gap-6 text-left">
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {packageInfo.features.map((feature) => (
          <li key={feature.title} className="border-primary-500/40 m-0 border-l-2 pl-4">
            <strong className="dark:text-white-light block text-slate-900">{feature.title}</strong>
            <span className="text-slate-600 dark:text-slate-300">{feature.description}</span>
          </li>
        ))}
      </ul>

      <Link href={`${packageInfo.href}/getting-started`} className="font-semibold">
        Get started with {packageInfo.name}
      </Link>
    </div>
  );
}

export default PackageFeatures;
