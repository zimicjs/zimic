import Link from '@docusaurus/Link';

import ExamplePanel from './ExamplePanel';
import { PackageInfo } from './packages';
import RequirementBadge from './RequirementBadge';

interface Props {
  package: PackageInfo;
  reversed?: boolean;
}

function PackagePanel({ package: packageInfo, reversed }: Props) {
  return (
    <ExamplePanel install={packageInfo.install} example={packageInfo.example} reversed={reversed}>
      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-primary-600 dark:text-primary-300 font-mono text-sm font-semibold">
            {packageInfo.name}
          </span>
          <RequirementBadge>{packageInfo.requirement}</RequirementBadge>
        </div>

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

      <Link href={packageInfo.href} className="font-semibold">
        Read the {packageInfo.name} docs
      </Link>
    </ExamplePanel>
  );
}

export default PackagePanel;
