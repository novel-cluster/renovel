import type { FC } from 'hono/jsx'

/** Labeled text input used across auth/settings forms. */
export const Field: FC<{
  label: string
  name: string
  type?: string
  value?: string
  required?: boolean
  autocomplete?: string
  help?: string
}> = ({ label, name, type = 'text', value, required, autocomplete, help }) => (
  <label class="block">
    <span class="mb-1 block text-sm font-medium">{label}</span>
    <input
      class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      type={type}
      name={name}
      value={value}
      required={required}
      autocomplete={autocomplete}
    />
    {help ? <span class="mt-1 block text-xs text-muted-foreground">{help}</span> : null}
  </label>
)

/** Primary submit button. */
export const SubmitButton: FC<{ label: string }> = ({ label }) => (
  <button
    type="submit"
    class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
  >
    {label}
  </button>
)

/** Inline error banner. */
export const FormError: FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>
  ) : null
