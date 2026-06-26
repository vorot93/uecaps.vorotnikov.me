import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { type Theme, getStoredTheme, applyTheme } from '~/lib/theme';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default component$(() => {
  const theme = useSignal<Theme>('system');

  // Reflect the saved preference on mount, and keep `System` reactive to live
  // OS changes. Browser-only — guarded so the Node/createDOM env never throws.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    theme.value = getStoredTheme();
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme.value === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    cleanup(() => mq.removeEventListener('change', onChange));
  });

  return (
    <div
      role="group"
      aria-label="Theme"
      class="inline-flex overflow-hidden rounded border border-gray-300 dark:border-gray-600"
    >
      {OPTIONS.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={theme.value === opt.value}
          class={
            'px-3 py-1.5 text-sm font-semibold ' +
            (i > 0 ? 'border-l border-gray-300 dark:border-gray-600 ' : '') +
            (theme.value === opt.value
              ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')
          }
          onClick$={() => {
            theme.value = opt.value;
            applyTheme(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
});
