import { ZodType } from "zod"
import { ValidationError } from "../errors"

/**
 * Validates raw input (req.query, req.params, req.body) against a Zod schema.
 * Throws a 400 HttpError with Zod issue details on failure.
 * Returns the parsed, type-safe data on success.
 */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "value"}: ${i.message}`)
      .join("; ")
    throw new ValidationError(`Validation error: ${issues}`)
  }
  return result.data
}
