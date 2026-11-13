import { useState } from 'react';

import HomeSection from '../../components/HomeSection';
import HomeVariationLayout from '../shared/HomeVariationLayout';
import { getInstallCommands, goals } from '../shared/packages';
import ProjectCards from '../shared/ProjectCards';
import Snippet from '../shared/Snippet';

function PickerHomePage() {
  const [selectedGoalIds, setSelectedGoalIds] = useState(['http-client']);
  const selectedGoals = goals.filter((goal) => selectedGoalIds.includes(goal.id));

  function toggleGoal(goalId: string) {
    setSelectedGoalIds((goalIds) =>
      goalIds.includes(goalId) ? goalIds.filter((id) => id !== goalId) : [...goalIds, goalId],
    );
  }

  return (
    <HomeVariationLayout>
      <HomeSection
        title="Install only what you use"
        titleId="picker"
        description="Select what your project needs. The command installs those packages and nothing else."
        className="max-w-6xl px-6 md:px-12"
      >
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0 lg:sticky lg:top-24">
            <legend className="dark:text-white-light mb-3 p-0 text-xl font-bold text-slate-900">
              My project needs to
            </legend>

            {goals.map((goal) => (
              <label
                key={goal.id}
                className="border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/15 hover:bg-primary-500/15 dark:hover:bg-primary-600/30 has-checked:border-primary-500 has-focus-visible:ring-primary-300 grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-xl border-2 p-4 transition-colors has-focus-visible:ring-2"
              >
                <input
                  type="checkbox"
                  checked={selectedGoalIds.includes(goal.id)}
                  onChange={() => toggleGoal(goal.id)}
                  className="accent-primary-600 row-span-2 mt-1 h-4 w-4"
                />
                <strong className="dark:text-white-light text-slate-900">{goal.label}</strong>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                  {goal.packages.map((packageInfo) => packageInfo.name).join(' + ')}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
            {selectedGoals.length === 0 ? (
              <p className="mb-0 text-slate-600 dark:text-slate-300">
                Select at least one option to see what to install.
              </p>
            ) : (
              <>
                <Snippet language="bash" code={getInstallCommands(selectedGoals)} />

                {selectedGoals.map((goal) => (
                  <Snippet key={goal.id} title={goal.example.title} code={goal.example.code} />
                ))}
              </>
            )}
          </div>
        </div>
      </HomeSection>

      <ProjectCards />
    </HomeVariationLayout>
  );
}

export default PickerHomePage;
