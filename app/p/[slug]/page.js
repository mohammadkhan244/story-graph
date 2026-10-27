import Flow from '@/components/Flow';

export const dynamic = 'force-dynamic';

export default function Page({ params }) {
  return <Flow mode="prompt" id={params.slug} />;
}
