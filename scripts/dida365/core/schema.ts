type Schema<T = unknown> = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
  enum?: T[];
};

type Err = { path: string[]; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTypes(type?: string | string[]): string[] {
  if (!type) return [];
  return Array.isArray(type) ? type : [type];
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    default:
      return true;
  }
}

export function validateAgainstSchema<T = unknown>(
  schema: Schema<T>,
  data: unknown,
  path: string[] = []
): Err[] {
  const errs: Err[] = [];
  if (data === undefined || data === null) return errs;

  const types = normalizeTypes(schema.type);
  if (types.length && !types.some((t) => matchesType(t, data))) {
    errs.push({ path: path.length ? path : ["root"], message: `expected ${types.join("|")}` });
    return errs;
  }

  if (schema.enum && !(schema.enum as unknown[]).includes(data)) {
    errs.push({ path: path.length ? path : ["root"], message: `expected one of ${JSON.stringify(schema.enum)}` });
  }

  if (typeof data === "number") {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errs.push({ path: path.length ? path : ["root"], message: `min ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errs.push({ path: path.length ? path : ["root"], message: `max ${schema.maximum}` });
    }
  }

  if (types.includes("object") && isPlainObject(data)) {
    const props = schema.properties ?? {};
    const required = schema.required ?? [];
    for (const r of required) {
      if (data[r] === undefined) {
        errs.push({ path: [...path, r], message: "required" });
      }
    }

    if (schema.additionalProperties === false) {
      for (const k of Object.keys(data)) {
        if (!props[k]) {
          errs.push({ path: [...path, k], message: "unknown property" });
        }
      }
    }

    for (const k of Object.keys(props)) {
      if (data[k] !== undefined) {
        errs.push(...validateAgainstSchema(props[k], data[k] as unknown, [...path, k]));
      }
    }
  }

  if (types.includes("array") && Array.isArray(data) && schema.items) {
    data.forEach((item, idx) => {
      errs.push(...validateAgainstSchema(schema.items!, item, [...path, `${idx}`]));
    });
  }

  return errs;
}
