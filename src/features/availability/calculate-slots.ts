/** Instantes UTC em milissegundos desde Unix epoch; intervalo [start, end). */
export type TimeInterval = { start: number; end: number }

type CalculateSlotsInput = {
  workingPeriod: TimeInterval
  busyPeriods: readonly TimeInterval[]
  durationMinutes: number
  slotIntervalMinutes: number
}

function validateInterval(interval: TimeInterval) {
  if (![interval.start, interval.end].every((value) => Number.isSafeInteger(value) && Math.abs(value) <= 8.64e15) || interval.end <= interval.start) {
    throw new RangeError('Intervals must contain valid timestamps with end after start.')
  }
}

/** Grelha ancorada no início do período; não faz conversão de timezone nem reserva vagas. */
export function calculateSlots({ workingPeriod, busyPeriods, durationMinutes, slotIntervalMinutes }: CalculateSlotsInput): TimeInterval[] {
  validateInterval(workingPeriod)
  busyPeriods.forEach(validateInterval)
  for (const minutes of [durationMinutes, slotIntervalMinutes]) {
    if (!Number.isSafeInteger(minutes) || minutes <= 0 || !Number.isSafeInteger(minutes * 60_000)) {
      throw new RangeError('Duration and slot interval must be positive integer minutes.')
    }
  }

  const duration = durationMinutes * 60_000
  const step = slotIntervalMinutes * 60_000
  const slots: TimeInterval[] = []
  for (let start = workingPeriod.start; start <= workingPeriod.end - duration; start += step) {
    const end = start + duration
    if (!busyPeriods.some((busy) => start < busy.end && end > busy.start)) {
      slots.push({ start, end })
    }
  }
  return slots
}
