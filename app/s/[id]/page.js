import SessionPage from '@/components/SessionPage';

export const dynamic = 'force-dynamic';

export default function Page({ params }) {
  return <SessionPage id={params.id} />;
}
