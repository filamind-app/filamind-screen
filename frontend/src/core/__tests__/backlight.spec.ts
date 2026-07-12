import { describe, expect, it, vi } from 'vitest'

// No @tauri-apps runtime in the test env, so the dynamic import inside applyBacklight rejects and
// the call is a silent no-op - which is exactly the browser-preview behaviour we want to prove.
import { applyBacklight, setBacklightPower } from '@/core/backlight'

describe('applyBacklight', () => {
  it('never throws when not running under Tauri', async () => {
    await expect(applyBacklight(0.5)).resolves.toBeUndefined()
  })

  it('never throws on out-of-range input', async () => {
    await expect(applyBacklight(0)).resolves.toBeUndefined()
    await expect(applyBacklight(5)).resolves.toBeUndefined()
    await expect(applyBacklight(-1)).resolves.toBeUndefined()
  })

  it('does not log or surface errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await applyBacklight(0.75)
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })
})

describe('setBacklightPower', () => {
  it('never throws when not running under Tauri', async () => {
    await expect(setBacklightPower(false)).resolves.toBeUndefined()
    await expect(setBacklightPower(true)).resolves.toBeUndefined()
  })

  it('does not log or surface errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await setBacklightPower(false)
    await setBacklightPower(true)
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })
})
