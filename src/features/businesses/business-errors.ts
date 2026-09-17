export function getBusinessErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  if (code === '23505') return 'Este identificador já está em uso. Escolha outro.'
  if (code === '23514' || code === '23502') return 'Verifique os dados da empresa e tente novamente.'
  if (code === '42501' || code === 'PGRST301') return 'Não tem autorização para esta operação. Verifique a sua sessão.'
  return 'Não foi possível concluir o pedido. Verifique a ligação e tente novamente.'
}
