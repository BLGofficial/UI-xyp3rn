import { Suspense } from 'react';
import { MapScreen } from '@/components/MapScreen';

export default function MapPage() {
  return (
    // MapScreen reads ?open= through useSearchParams, which needs a Suspense boundary to prerender.
    <Suspense fallback={null}>
      <MapScreen />
    </Suspense>
  );
}
