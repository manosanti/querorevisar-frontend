// /__ds — design system gallery for visual review against reference/QueroRevisar Design System.dc.html (dev only).
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const Gallery = lazy(() => import('../features/ds/Gallery.tsx'));

export const Route = createFileRoute('/__ds')({
  component: () =>
    import.meta.env.DEV ? (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    ) : (
      <Navigate to="/" replace />
    ),
});
