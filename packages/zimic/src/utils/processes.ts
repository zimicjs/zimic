import { spawn } from 'child_process';

export async function runCommand(
  command: string,
  options: {
    shell?: boolean | string;
  },
) {
  await new Promise<void>((resolve, reject) => {
    const childProcess = spawn(command, {
      shell: options.shell,
      stdio: 'inherit',
    });

    childProcess.once('exit', (code) => {
      childProcess.removeAllListeners();

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`The command '${command}' exited with code ${code}.`));
      }
    });

    childProcess.once('error', (error) => {
      childProcess.removeAllListeners();
      reject(error);
    });
  });
}
