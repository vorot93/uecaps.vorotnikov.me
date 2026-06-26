import { component$ } from '@builder.io/qwik';

export default component$(({ warnings }: { warnings?: string[] }) => {
  if (!warnings || warnings.length === 0) {
    return <></>;
  }

  return (
    <div
      role="status"
      class="mb-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
    >
      <ul class="list-disc pl-5">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
});
