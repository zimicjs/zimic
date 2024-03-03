/** Value that can be represented in JSON. */
export type JSONValue =
  | {
      [Key in never]: JSONValue;
    }
  | JSONValue[]
  | string
  | number
  | boolean
  | null
  | undefined;
