'use client';

import { useRouter } from 'next/navigation';
import { JarvisView } from '@/components/JarvisView';
import { departments } from '@/data/map';

export default function JarvisPage() {
  const router = useRouter();
  return (
    <JarvisView
      activeSector={departments[0]!.id}
      selectedJobId={null}
      onClose={() => router.push('/map')}
      onSelectJob={() => router.push('/map')}
    />
  );
}

