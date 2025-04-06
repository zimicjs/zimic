export type TableLogRow = Record<string, string>;

export interface TableLogHeader<Row extends TableLogRow> {
  title: string;
  property: keyof Row;
}

export interface LoggerOptions {
  prefix?: string;
}

class Logger {
  prefix?: string;

  raw: Logger;

  constructor(options: LoggerOptions = {}) {
    const { prefix } = options;

    this.prefix = prefix;

    this.raw = prefix ? new Logger({ ...options, prefix: undefined }) : this;
  }

  private log(level: 'info' | 'warn' | 'error', ...messages: unknown[]) {
    if (this.prefix) {
      console[level](this.prefix, ...messages);
    } else {
      console[level](...messages);
    }
  }

  info(...messages: unknown[]) {
    this.log('info', ...messages);
  }

  warn(...messages: unknown[]) {
    this.log('warn', ...messages);
  }

  error(...messages: unknown[]) {
    this.log('error', ...messages);
  }

  table<Row extends TableLogRow>(headers: TableLogHeader<Row>[], rows: Row[]) {
    const columnLengths = headers.map((header) => {
      let maxValueLength = header.title.length;

      for (const row of rows) {
        const value = row[header.property];

        if (value.length > maxValueLength) {
          maxValueLength = value.length;
        }
      }

      return maxValueLength;
    });

    const formattedRows: string[][] = [];

    const horizontalLine = columnLengths.map((length) => '─'.repeat(length));
    formattedRows.push(horizontalLine, []);

    for (let headerIndex = 0; headerIndex < headers.length; headerIndex++) {
      const header = headers[headerIndex];
      const columnLength = columnLengths[headerIndex];

      const value = header.title;
      formattedRows.at(-1)?.push(value.padEnd(columnLength, ' '));
    }

    formattedRows.push(horizontalLine);

    for (const row of rows) {
      formattedRows.push([]);

      for (let headerIndex = 0; headerIndex < headers.length; headerIndex++) {
        const header = headers[headerIndex];
        const columnLength = columnLengths[headerIndex];

        const value = row[header.property];
        formattedRows.at(-1)?.push(value.padEnd(columnLength, ' '));
      }
    }

    formattedRows.push(horizontalLine);

    const formattedTable = formattedRows
      .map((row, index) => {
        const isFirstLine = index === 0;
        if (isFirstLine) {
          return `┌─${row.join('─┬─')}─┐`;
        }

        const isLineAfterHeaders = index === 2;
        if (isLineAfterHeaders) {
          return `├─${row.join('─┼─')}─┤`;
        }

        const isLastLine = index === formattedRows.length - 1;
        if (isLastLine) {
          return `└─${row.join('─┴─')}─┘`;
        }

        return `│ ${row.join(' │ ')} │`;
      })
      .join('\n');

    this.log('info', formattedTable);
  }
}

export default Logger;
