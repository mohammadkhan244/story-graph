import PromptPage from '@/components/PromptPage';

export const dynamic = 'force-dynamic';

export default function Page({ params }) {
  return <PromptPage slug={params.slug} />;
}
