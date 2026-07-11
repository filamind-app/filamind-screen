import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/core/i18n'
import { oskTarget } from '@/core/osk'
import OnScreenKeyboard from '../OnScreenKeyboard.vue'

let input: HTMLInputElement

const mountKb = () =>
  mount(OnScreenKeyboard, { global: { plugins: [i18n], stubs: { teleport: true } } })

const keyByText = (w: VueWrapper, label: string) =>
  w.findAll('button.k').find((b) => b.text() === label)!
const keyByLabel = (w: VueWrapper, aria: string) => w.find(`button[aria-label="${aria}"]`)

beforeEach(() => {
  document.body.innerHTML = ''
  input = document.createElement('input')
  input.type = 'text'
  document.body.appendChild(input)
  input.focus()
  oskTarget.value = input
})

describe('OnScreenKeyboard', () => {
  // Keys act on pointerdown, not click: on WebKitGTK touch a canceled pointerdown suppresses the
  // whole click sequence, so a click-bound key would be dead on the device.
  it('types on pointerdown into the focused input and fires input events (v-model path)', async () => {
    const w = mountKb()
    const seen: string[] = []
    input.addEventListener('input', () => seen.push(input.value))
    await keyByText(w, 'G').trigger('pointerdown')
    await keyByText(w, '2').trigger('pointerdown')
    await keyByText(w, '8').trigger('pointerdown')
    expect(input.value).toBe('G28')
    expect(seen).toEqual(['G', 'G2', 'G28'])
  })

  it('backspace removes the character before the caret', async () => {
    input.value = 'G28'
    input.setSelectionRange(3, 3)
    const w = mountKb()
    await keyByLabel(w, i18n.global.t('temp.backspace')).trigger('pointerdown')
    expect(input.value).toBe('G2')
  })

  it('the case toggle switches the letter keys to lowercase', async () => {
    const w = mountKb()
    await keyByLabel(w, i18n.global.t('osk.shift')).trigger('pointerdown')
    await keyByText(w, 'q').trigger('pointerdown')
    expect(input.value).toBe('q')
  })

  it('close releases the input and hides the keyboard', async () => {
    const w = mountKb()
    await keyByLabel(w, i18n.global.t('osk.close')).trigger('pointerdown')
    expect(oskTarget.value).toBeNull()
    expect(w.find('.osk').exists()).toBe(false)
  })

  it('closes itself when the target has detached (no focusout fires on removal)', async () => {
    const w = mountKb()
    input.remove() // view unmounted while focused - browsers fire no focusout
    await keyByText(w, 'G').trigger('pointerdown')
    expect(oskTarget.value).toBeNull()
    expect(w.find('.osk').exists()).toBe(false)
  })
})
