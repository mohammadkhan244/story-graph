import Home from '@/components/Home';
import Admin from '@/components/Admin';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }) {
  if (searchParams && 'admin' in searchParams) return <Admin />;
  return <Home />;
}
