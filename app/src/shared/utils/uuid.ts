/**
 * UUIDv7 generation, wrapped so the rest of the app depends on this module
 * rather than the Bun global directly (data-model.md §1.1 — v7 is time-sortable
 * for index locality). Domain identifier value objects call this.
 */
export function uuidv7(): string {
  return Bun.randomUUIDv7()
}
