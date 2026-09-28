import type { Page } from '@playwright/test'
import { test, expect, syntheticSession, type TestApi } from './fixtures'
import { auditAccessibility } from './accessibility'

const userId = 'a2000000-0000-4000-8000-000000000001'
const businessId = 'a1000000-0000-4000-8000-000000000001'
async function setup(api: TestApi, role: 'owner' | 'employee' = 'owner') {
  await api.signIn(userId)
  const state = { profile: { full_name: 'Miguel Silva', avatar_path: null as string | null }, business: {
    id: businessId, name: 'BarberShop', slug: 'barbershop', timezone: 'Europe/Lisbon', is_active: true, public_booking_enabled: true,
    cancellation_notice_hours: 12, logo_path: null as string | null, description: '', phone: '', email: '', address: '',
  } }
  api.on('get_my_profile', async (route) => route.fulfill({ json: state.profile }))
  api.on('save_my_profile', async (route, body) => { state.profile.full_name = String(body.profile_name); await route.fulfill({ json: state.profile }) })
  api.on('set_my_avatar', async (route, body) => { state.profile.avatar_path = body.image_path as string | null; await route.fulfill({ json: state.profile }) })
  api.onGet('business_members', async (route) => route.fulfill({ json: [{ role, business: state.business }] }))
  api.on('list_business_members', async (route) => route.fulfill({ json: [] }))
  return state
}
async function photo(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100
    const context = canvas.getContext('2d')!; context.fillStyle = '#a34623'; context.fillRect(0, 0, 100, 100)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}
function storage(api: TestApi, image: Buffer) {
  let savedImage = image
  api.onStorage(async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: savedImage.subarray(0, 4).toString() === 'RIFF' ? 'image/webp' : 'image/png', headers: { 'access-control-allow-origin': '*' }, body: savedImage })
    if (route.request().method() === 'POST') {
      const body = route.request().postDataBuffer()!
      const start = body.indexOf(Buffer.from('RIFF'))
      expect(start).toBeGreaterThanOrEqual(0)
      savedImage = body.subarray(start, start + 8 + body.readUInt32LE(start + 4))
      expect(savedImage.subarray(8, 12).toString()).toBe('WEBP')
      return route.fulfill({ json: { Key: new URL(route.request().url()).pathname.replace('/storage/v1/object/', '') } })
    }
    if (route.request().method() === 'DELETE') return route.fulfill({ json: [] })
    throw new Error('Unexpected storage operation')
  })
  return { get image() { return savedImage } }
}

test('negócios mais compactos e perfil pessoal editável com persistência', async ({ page, api }, info) => {
  await setup(api, 'employee')
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Os seus negócios.' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('businesses.png'), fullPage: true })
  await auditAccessibility(page, info)
  await page.getByRole('link', { name: 'Editar perfil' }).click()
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Miguel Silva')
  await page.screenshot({ path: info.outputPath('profile.png'), fullPage: true })
  await auditAccessibility(page, info)
  await page.getByLabel('Nome', { exact: true }).fill('Miguel Santos')
  await page.getByRole('button', { name: 'Guardar nome' }).click()
  await expect(page.getByText('Nome atualizado.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Miguel Santos')
  await page.getByRole('link', { name: '← Os meus negócios' }).click()
  await expect(page.getByText('Miguel Santos', { exact: true })).toBeVisible()
})

test('fotografia validada, enviada só após guardar e removível', async ({ page, api }) => {
  const state = await setup(api, 'employee')
  await page.goto('/account')
  const input = page.getByLabel('Escolher fotografia')
  await input.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg />') })
  await expect(page.getByText('Escolha uma imagem JPG, PNG ou WebP.')).toBeVisible()
  expect(api.calls.some((call) => call.name === 'STORAGE:POST')).toBe(false)
  const file = await photo(page); storage(api, file.buffer)
  await input.setInputFiles(file)
  await expect(page.getByRole('img', { name: 'Fotografia de Miguel Silva' })).toHaveAttribute('src', /^blob:/)
  expect(state.profile.avatar_path).toBeNull()
  await page.getByRole('button', { name: 'Guardar imagem' }).click()
  await expect(page.getByText('Imagem guardada.')).toBeVisible()
  expect(state.profile.avatar_path).toMatch(new RegExp(`^users/${userId}/[a-f0-9-]+\\.webp$`))
  await page.reload()
  await expect(page.getByRole('img', { name: 'Fotografia de Miguel Silva' })).toHaveAttribute('src', /\/storage\/v1\/object\/public\/brand-images\/users\//)
  await page.getByRole('button', { name: 'Remover imagem' }).click()
  await expect(page.getByText('Imagem removida.')).toBeVisible()
  expect(state.profile.avatar_path).toBeNull()
  expect(api.calls.some((call) => call.name === 'STORAGE:DELETE')).toBe(true)
})

test('email aguarda confirmação e password suporta reautenticação sem guardar credenciais', async ({ page, api }) => {
  await setup(api)
  const user = syntheticSession(userId).user
  api.onAuth('user', async (route, body) => {
    if (body.email) return route.fulfill({ json: { ...user, new_email: body.email } })
    if (body.password && !body.nonce) return route.fulfill({ status: 400,
      headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'x-supabase-api-version' },
      json: { code: 'reauthentication_needed', msg: 'Required' } })
    if (body.password) expect(body).toMatchObject({ current_password: 'Old-password-123', password: 'New-password-456', nonce: '123456' })
    await route.fulfill({ json: user })
  })
  api.onAuth('reauthenticate', async (route) => route.fulfill({ json: {} }))
  await page.goto('/account')
  await page.getByLabel('Novo email', { exact: true }).fill('new@example.test')
  await page.getByRole('button', { name: 'Alterar email' }).click()
  await expect(page.getByText('Pedido enviado.', { exact: false })).toBeVisible()
  await expect(page.getByText('Atual: team@example.test')).toBeVisible()
  await page.getByLabel('Password atual', { exact: true }).fill('Old-password-123')
  await page.getByLabel('Nova password', { exact: true }).fill('New-password-456')
  await page.getByLabel('Confirmar nova password', { exact: true }).fill('Different-password')
  await page.getByRole('button', { name: 'Guardar password' }).click()
  await expect(page.getByText('As passwords não coincidem.')).toBeVisible()
  expect(api.calls.filter((call) => call.body.password)).toHaveLength(0)
  await page.getByLabel('Confirmar nova password', { exact: true }).fill('New-password-456')
  await page.getByRole('button', { name: 'Guardar password' }).click()
  await page.getByRole('button', { name: 'Enviar código de confirmação' }).click()
  await expect(page.getByText('Código enviado. Consulte o seu email.')).toBeVisible()
  await page.getByLabel('Código de confirmação', { exact: true }).fill('123456')
  await page.getByRole('button', { name: 'Guardar password' }).click()
  await expect(page.getByText('Password atualizada.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Nova password', { exact: true })).toHaveValue('')
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain('New-password-456')
})

test('proprietário edita empresa e logótipo e colaborador não vê estes controlos', async ({ page, api }, info) => {
  const state = await setup(api)
  api.on('set_business_logo', async (route, body) => { expect(body.target_business_id).toBe(businessId); state.business.logo_path = body.image_path as string | null; await route.fulfill({ json: null }) })
  api.on('save_business_details', async (route, body) => { state.business.name = String(body.business_name); await route.fulfill({ json: null }) })
  await page.goto(`/dashboard/${businessId}?view=settings`)
  const file = await photo(page); storage(api, file.buffer)
  await page.getByLabel('Escolher logótipo').setInputFiles(file)
  await page.getByRole('button', { name: 'Guardar imagem' }).click()
  await expect(page.getByText('Imagem guardada.')).toBeVisible()
  expect(state.business.logo_path).toMatch(new RegExp(`^businesses/${businessId}/`))
  await page.getByLabel('Nome da empresa', { exact: true }).fill('BarberShop Studio')
  await page.getByRole('button', { name: 'Guardar dados da empresa' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'BarberShop Studio' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('business-branding.png'), fullPage: true })
  await auditAccessibility(page, info)
  api.onGet('business_members', async (route) => route.fulfill({ json: [{ role: 'employee', business: state.business }] }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'A sua empresa' })).toBeVisible()
  await expect(page.getByLabel('Escolher logótipo')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Guardar dados da empresa' })).toHaveCount(0)
})

test('perfil sem dados abre e uma falha temporária permite tentar novamente', async ({ page, api }) => {
  await setup(api)
  let failed = false
  api.on('get_my_profile', async (route) => {
    if (!failed) { failed = true; await route.fulfill({ status: 503, json: { message: 'Unavailable' } }); return }
    await route.fulfill({ json: { full_name: '', avatar_path: null } })
  })
  await page.goto('/account')
  await expect(page.getByText('Não foi possível carregar o perfil. Tente novamente.')).toBeVisible()
  await expect(page.getByLabel('Novo email', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('')
  await page.getByLabel('Nome', { exact: true }).fill('Novo nome')
  await page.getByRole('button', { name: 'Guardar nome' }).click()
  await expect(page.getByText('Nome atualizado.', { exact: true })).toBeVisible()
})

test('modal ajusta o logótipo por arrasto e guarda os pixels da pré-visualização', async ({ page, api }, info) => {
  const state = await setup(api)
  api.on('set_business_logo', async (route, body) => { state.business.logo_path = body.image_path as string | null; await route.fulfill({ json: null }) })
  await page.goto(`/dashboard/${businessId}?view=settings`)
  const file = await photo(page)
  const stored = storage(api, file.buffer)
  const editor = page.getByRole('region', { name: 'Identidade da empresa' })
  await editor.getByLabel('Escolher logótipo').setInputFiles(file)
  const dialog = page.getByRole('dialog', { name: 'Ajustar imagem' })
  await expect(dialog).toBeVisible()
  const preview = dialog.getByRole('img', { name: 'Logótipo de BarberShop' })
  await expect(preview).toHaveAttribute('src', /^blob:/)
  await dialog.getByRole('slider', { name: 'Zoom da imagem' }).focus()
  await page.keyboard.press('Home')
  await expect(dialog.getByRole('slider')).toHaveCount(1)
  const position = dialog.getByRole('group', { name: 'Posicionar imagem' })
  const box = (await position.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const end = { x: start.x + box.width / 2, y: start.y - box.height / 5 }
  if (info.project.name === 'mobile') {
    const touch = await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await touch.detach()
  } else {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 8 })
    await page.mouse.up()
  }
  await expect(dialog.getByRole('button', { name: 'Guardar imagem' })).toBeEnabled()
  const cropped = await preview.evaluate(async (element: HTMLImageElement) => {
    const blob = await (await fetch(element.src)).blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0)
    const left = context.getImageData(100, 384, 1, 1).data[3]
    const right = context.getImageData(700, 384, 1, 1).data[3]
    const topRight = context.getImageData(700, 60, 1, 1).data[3]
    const bottomRight = context.getImageData(700, 700, 1, 1).data[3]
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()))
    bitmap.close()
    return { width: canvas.width, height: canvas.height, left, right, topRight, bottomRight, bytes }
  })
  expect(cropped).toMatchObject({ width: 768, height: 768, left: 0, right: 255, topRight: 255, bottomRight: 0 })
  expect(api.calls.some((call) => call.name === 'STORAGE:POST')).toBe(false)
  await auditAccessibility(page, info)
  await page.screenshot({ path: info.outputPath('image-framing.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Guardar imagem' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(editor.getByText('Imagem guardada.')).toBeVisible()
  expect(stored.image).toEqual(Buffer.from(cropped.bytes))
  const savedPath = state.business.logo_path
  await page.reload()
  await expect(editor.getByRole('img', { name: 'Logótipo de BarberShop' })).toHaveAttribute('src', new RegExp(savedPath!))
  await editor.getByRole('button', { name: 'Ajustar enquadramento' }).click()
  await expect(dialog.getByRole('slider', { name: 'Zoom da imagem' })).toBeVisible()
  await dialog.getByRole('slider', { name: 'Zoom da imagem' }).focus()
  await page.keyboard.press('End')
  await dialog.getByRole('button', { name: 'Repor enquadramento' }).click()
  await expect(dialog.getByRole('slider', { name: 'Zoom da imagem' })).toHaveValue('1')
  await position.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(editor.getByRole('button', { name: 'Ajustar enquadramento' })).toBeFocused()
  expect(state.business.logo_path).toBe(savedPath)
  expect(api.calls.filter((call) => call.name === 'STORAGE:POST')).toHaveLength(1)
  expect(api.calls.filter((call) => call.name === 'STORAGE:DELETE')).toHaveLength(0)
})
