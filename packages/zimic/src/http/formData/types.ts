/** A schema for strict HTTP form data. */
export interface HttpFormDataSchema {
  [fieldName: string]: string | string[] | Blob | Blob[] | null | undefined;
}
