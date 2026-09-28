import { isAuthError } from '@supabase/supabase-js'

const messages: Record<string, string> = {
  invalid_credentials: 'Email ou password incorretos.',
  email_not_confirmed: 'Confirme o seu email antes de entrar.',
  weak_password: 'Escolha uma password mais forte, com pelo menos 8 caracteres.',
  same_password: 'A nova password deve ser diferente da anterior.',
  over_request_rate_limit: 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.',
  over_email_send_rate_limit: 'O limite de envio foi atingido. Aguarde antes de pedir outro email.',
  email_address_not_authorized: 'O envio de emails ainda está limitado neste ambiente. Contacte o responsável pelo projeto.',
  signup_disabled: 'O registo está temporariamente indisponível.',
  session_not_found: 'A sessão expirou. Entre novamente ou peça um novo link.',
  otp_expired: 'O link expirou ou já foi utilizado. Peça um novo link.',
  email_exists: 'Não foi possível usar este email. Escolha outro endereço.',
  reauthentication_needed: 'Confirme a alteração com um código enviado para o seu email.',
  reauthentication_not_valid: 'O código de confirmação não é válido ou expirou. Peça um novo código.',
  invalid_current_password: 'A password atual não está correta.',
}

export function getAuthErrorMessage(error: unknown) {
  if (isAuthError(error)) {
    if (error.status === 429) return messages.over_request_rate_limit
    if (error.code && messages[error.code]) return messages[error.code]
  }
  return 'Não foi possível concluir o pedido. Verifique a ligação e tente novamente.'
}
