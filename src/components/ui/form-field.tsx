import { useId, type ComponentProps } from 'react'

type FormFieldProps = ComponentProps<'input'> & { label: string; error?: string; hint?: string }

export function FormField({ label, error, hint, id: suppliedId, ...props }: FormFieldProps) {
  const generatedId = useId()
  const id = suppliedId ?? generatedId
  const descriptionId = `${id}-description`
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>
      <input {...props} id={id} aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? descriptionId : undefined}
        className="min-h-12 w-full rounded-sm border border-line bg-surface px-3 py-3 text-base text-ink disabled:opacity-60 aria-invalid:border-brand" />
      {(error || hint) && <p id={descriptionId} className={`mt-2 text-sm ${error ? 'text-brand' : 'text-muted'}`}>{error || hint}</p>}
    </div>
  )
}
