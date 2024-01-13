import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chalk } from 'zx';

import Logger from '../logger';

describe('Logger', () => {
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

  beforeEach(() => {
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  const message = 'message';

  describe('Progress', () => {
    it('should log progress messages without knowing the total number of steps', () => {
      const logger = new Logger();

      logger.progress(message);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(`${chalk.dim('[...]')} ${message}`);
    });

    it('should log progress messages knowing the total number of steps', () => {
      const logger = new Logger(2);

      logger.progress(message);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(`${chalk.dim('[1/2]')} ${message}`);

      logger.progress(message);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(`${chalk.dim('[2/2]')} ${message}`);
    });
  });

  describe('Info', () => {
    it('should log info messages', () => {
      const logger = new Logger();

      logger.info(message);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(`${chalk.blue('info')} ${message}`);
    });
  });

  describe('Success', () => {
    it('should log success messages', () => {
      const logger = new Logger();

      logger.success(message);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(`${chalk.green('success')} ${message}`);
    });
  });

  describe('Warn', () => {
    it('should log warn messages', () => {
      const logger = new Logger();

      logger.warn(message);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(`${chalk.yellow('warn')} ${message}`);
    });
  });

  describe('Error', () => {
    it('should log error messages', () => {
      const logger = new Logger();

      logger.error(message);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(`${chalk.red('error')} ${message}`);
    });
  });
});
