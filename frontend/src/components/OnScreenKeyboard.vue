<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'
import { oskTarget, closeOsk } from '@/core/osk'

// The on-screen QWERTY keyboard: docks to the bottom edge whenever a text input has focus
// (see core/osk.ts). Tuned for what this device actually types - g-code, macro names, file
// names - so the symbol set is : _ - . / = " * and case defaults to UPPER (g-code convention)
// with a shift toggle for names.
//
// Keys act on POINTERDOWN, not click: on WebKitGTK touch (the kiosk runtime) preventing a
// pointerdown suppresses the whole synthetic mouse+click sequence, so a click-bound key never
// fires. Acting on pointerdown (and preventing it) both keeps the input focused - no blur, the
// keyboard stays open, the caret is preserved - and works on the actual device, where click
// never comes.
const { t } = useI18n()
const lower = ref(false)

const ROW_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const ROW_TOP = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
const ROW_HOME = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':']
const ROW_BOTTOM = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '_', '-']
const ROW_SYMS = ['=', '"', '*', '.', '/']

const face = (k: string): string => (/^[A-Z]$/.test(k) && lower.value ? k.toLowerCase() : k)

/** The target may have detached (view unmounted) or been disabled since focus - if so, close. */
function target(): HTMLInputElement | null {
  const el = oskTarget.value
  if (el && el.isConnected && !el.disabled) return el
  closeOsk()
  return null
}

function type(ch: string): void {
  const el = target()
  if (!el) return
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  el.setRangeText(ch, start, end, 'end')
  el.dispatchEvent(new Event('input', { bubbles: true })) // v-model listens for this
}
function backspace(): void {
  const el = target()
  if (!el) return
  let start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  if (start === end && start > 0) start -= 1
  if (start === end) return
  el.setRangeText('', start, end, 'end')
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
function enter(): void {
  // Submit the input's own form (the console's send path); a formless input just keeps focus.
  target()?.form?.requestSubmit()
}
</script>

<template>
  <teleport to="body">
    <!-- pointerdown.prevent at the root: taps on gaps between keys must not blur the input. -->
    <div
      v-if="oskTarget"
      class="osk"
      dir="ltr"
      role="group"
      :aria-label="t('osk.label')"
      @pointerdown.prevent
    >
      <div class="osk-row">
        <button
          v-for="k in ROW_DIGITS"
          :key="k"
          class="k"
          type="button"
          @pointerdown.prevent="type(k)"
        >
          {{ k }}
        </button>
      </div>
      <div class="osk-row">
        <button
          v-for="k in ROW_TOP"
          :key="k"
          class="k"
          type="button"
          @pointerdown.prevent="type(face(k))"
        >
          {{ face(k) }}
        </button>
      </div>
      <div class="osk-row">
        <button
          v-for="k in ROW_HOME"
          :key="k"
          class="k"
          type="button"
          @pointerdown.prevent="type(face(k))"
        >
          {{ face(k) }}
        </button>
      </div>
      <div class="osk-row">
        <button
          class="k mod"
          type="button"
          :class="{ on: lower }"
          :aria-pressed="lower"
          :aria-label="t('osk.shift')"
          @pointerdown.prevent="lower = !lower"
        >
          {{ lower ? 'ABC' : 'abc' }}
        </button>
        <button
          v-for="k in ROW_BOTTOM"
          :key="k"
          class="k"
          type="button"
          @pointerdown.prevent="type(face(k))"
        >
          {{ face(k) }}
        </button>
        <button
          class="k mod"
          type="button"
          :aria-label="t('temp.backspace')"
          @pointerdown.prevent="backspace"
        >
          <Icon name="backspace" size="1.2rem" />
        </button>
      </div>
      <div class="osk-row">
        <button
          v-for="k in ROW_SYMS"
          :key="k"
          class="k"
          type="button"
          @pointerdown.prevent="type(k)"
        >
          {{ k }}
        </button>
        <button
          class="k space"
          type="button"
          :aria-label="t('osk.space')"
          @pointerdown.prevent="type(' ')"
        >
          ␣
        </button>
        <button
          class="k mod enter"
          type="button"
          :aria-label="t('osk.enter')"
          @pointerdown.prevent="enter"
        >
          <Icon name="check" size="1.2rem" />
        </button>
        <button
          class="k mod"
          type="button"
          :aria-label="t('osk.close')"
          @pointerdown.prevent="closeOsk"
        >
          <Icon name="close" size="1.2rem" />
        </button>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.osk {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  height: var(--osk-h, 16rem);
  z-index: 50; /* under the prompt backdrop (60): a prompt steals focus and closes the OSK */
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-2);
  background: var(--fm-surface);
  border-top: 1px solid var(--fm-border);
  box-shadow: 0 -0.4rem 1.2rem rgba(0, 0, 0, 0.35);
}
.osk-row {
  flex: 1;
  display: flex;
  gap: var(--sp-1);
}
.k {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--fm-border);
  border-radius: 0.5rem;
  background: var(--fm-surface-2);
  color: var(--fm-text);
  font-family: var(--font-mono);
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.k:active {
  background: var(--fm-primary);
  color: var(--fm-primary-contrast);
}
.mod {
  flex: 1.4;
  color: var(--fm-text-muted);
  font-size: 0.9rem;
}
.mod.on {
  border-color: var(--fm-primary);
  color: var(--fm-primary);
}
.enter {
  background: var(--fm-primary);
  border-color: transparent;
  color: var(--fm-primary-contrast);
}
.space {
  flex: 3;
  color: var(--fm-text-muted);
}
</style>
