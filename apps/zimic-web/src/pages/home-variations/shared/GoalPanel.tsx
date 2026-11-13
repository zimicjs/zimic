import Link from '@docusaurus/Link';

import ExamplePanel from './ExamplePanel';
import { getInstallCommands, Goal } from './packages';

interface Props {
  goal: Goal;
}

function GoalPanel({ goal }: Props) {
  return (
    <ExamplePanel install={getInstallCommands([goal])} example={goal.example}>
      <h3 className="dark:text-white-light mb-0 text-2xl font-bold text-slate-900">{goal.label}</h3>

      <p className="mb-0 text-base text-slate-600 dark:text-slate-300">{goal.description}</p>

      <div className="flex flex-col gap-3">
        <strong className="dark:text-white-light text-slate-900">
          {goal.packages.length === 1 ? 'You install one package' : `You install ${goal.packages.length} packages`}
        </strong>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {goal.packages.map((packageInfo) => (
            <li key={packageInfo.name} className="border-primary-500/40 m-0 border-l-2 pl-4">
              <Link href={packageInfo.href} className="block font-mono text-sm font-semibold">
                {packageInfo.name}
              </Link>
              <span className="text-slate-600 dark:text-slate-300">{packageInfo.summary}</span>
            </li>
          ))}
        </ul>
      </div>
    </ExamplePanel>
  );
}

export default GoalPanel;
