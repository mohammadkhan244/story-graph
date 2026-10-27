import Presenter from '@/components/Presenter';

export const dynamic = 'force-dynamic';

export default function Page({ params }) {
  return <Presenter id={params.id} />;
}
