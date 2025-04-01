type TableLogRow = Record<string, string>;

interface TableLogHeader<Row extends TableLogRow> {
  title: string;
  property: keyof Row;
}

export function logAsTable<Row extends TableLogRow>(headers: TableLogHeader<Row>[], rows: Row[]) {
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

  const formattedRows: string[][] = [[]];

  for (let headerIndex = 0; headerIndex < headers.length; headerIndex++) {
    const header = headers[headerIndex];
    const columnLength = columnLengths[headerIndex];

    const value = header.title;
    formattedRows.at(-1)?.push(value.padEnd(columnLength, ' '));
  }

  for (const row of rows) {
    formattedRows.push([]);

    for (let headerIndex = 0; headerIndex < headers.length; headerIndex++) {
      const header = headers[headerIndex];
      const columnLength = columnLengths[headerIndex];

      const value = row[header.property];
      formattedRows.at(-1)?.push(value.padEnd(columnLength, ' '));
    }
  }

  const formattedTable = formattedRows.map((row) => row.join('   ')).join('\n');
  console.log(formattedTable);
}
