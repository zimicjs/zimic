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
