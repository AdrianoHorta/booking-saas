import { Temporal } from '@js-temporal/polyfill'

export function businessToday(timezone: string) {
  return Temporal.Instant.fromEpochMilliseconds(Date.now()).toZonedDateTimeISO(timezone).toPlainDate().toString()
}
