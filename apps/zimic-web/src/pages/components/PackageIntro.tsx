import { PackageInfo } from './packages';

interface Props {
  package: PackageInfo;
}

function PackageIntro({ package: packageInfo }: Props) {
  return (
    <div className="flex flex-col items-start gap-4 text-left">
      <span className="text-primary-600 dark:text-primary-300 font-mono text-sm font-semibold">{packageInfo.name}</span>
      <h3 className="dark:text-white-light mb-0 text-2xl font-bold text-slate-900 md:text-3xl">
        {packageInfo.summary}
      </h3>
      <p className="mb-0 max-w-2xl text-base text-slate-600 dark:text-slate-300">{packageInfo.description}</p>
    </div>
  );
}

export default PackageIntro;
