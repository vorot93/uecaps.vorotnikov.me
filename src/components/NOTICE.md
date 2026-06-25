# Attribution Notice

The components in `src/components/viewer/`, `src/components/table/`,
`src/components/inputs/`, `src/helpers/`, and `src/styles/` are forked
from **HandyMenny/uecapabilityparser-web**
(https://github.com/HandyMenny/uecapabilityparser-web), copyright HandyMenny,
licensed under the **MIT License**.

Modifications made for this project:
- Type imports repointed from `~/@types/uecapabilityparser` to
  `~/parser/types/uecapabilityparser` (our vendored type definitions).
- `capability-view.tsx`: server-side CSV download (axios + Endpoints.CSV) and
  input-download (Endpoints.STORE) stripped; CSV export deferred to Phase 2.
- `multicapability-view.tsx`: axios call to `Endpoints.STORE/getItem` for
  inputs fetch stripped; component is now a pure function of `Capabilities[]`.
- `helpers/status.ts` (uses axios-cache-interceptor + Endpoints.STATUS): not
  included — not needed by the kept components.
- `helpers/endpoints.ts`: not included.
- All network calls removed; the rendering is 100% browser-only.
