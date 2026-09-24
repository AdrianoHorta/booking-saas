import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { getSupabase } from '../../../lib/supabase/client'
import { Button } from '../../../components/ui/button'
import { FormField } from '../../../components/ui/form-field'
import { Message } from '../../../components/feedback/message'

export function CancellationSettings({ businessId, initialHours }: { businessId: string; initialHours: number }) {
  const [hours, setHours] = useState(String(initialHours))
  const client = useQueryClient()
  const valid = hours.trim() !== '' && z.number().int().min(0).max(720).safeParse(Number(hours)).success
  const mutation = useMutation({ mutationFn: async () => {
    const value = z.number().int().min(0).max(720).parse(Number(hours))
    const { error } = await getSupabase().rpc('set_cancellation_policy', { target_business_id: businessId, notice_hours: value })
    if (error) throw new Error('Não foi possível guardar o prazo. Verifique a sua permissão e tente novamente.')
  }, onSuccess: () => Promise.all(['business','businesses','public-booking-catalog'].map((key) => client.invalidateQueries({ queryKey: [key] }))) })
  return <form className="max-w-xl space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid) mutation.mutate() }}>
    <h3 className="font-display text-2xl">Prazo de cancelamento</h3>
    <p className="text-sm text-muted">Define a antecedência mínima para cancelar. Aplica-se a novas reservas; as existentes mantêm o prazo com que foram criadas. Use 0 para permitir até ao início.</p>
    <FormField label="Antecedência mínima (horas)" type="number" min={0} max={720} step={1} required value={hours} disabled={mutation.isPending}
      onChange={(event) => { setHours(event.target.value); mutation.reset() }} />
    <Button type="submit" disabled={!valid || mutation.isPending}>{mutation.isPending ? 'A guardar…' : 'Guardar prazo'}</Button>
    {mutation.isError && <Message error>{mutation.error.message}</Message>}
    {mutation.isSuccess && <Message>Prazo de cancelamento guardado.</Message>}
  </form>
}
