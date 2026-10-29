import { q } from '@/lib/db';
import MapView from '@/components/MapView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  try {
    const { id } = params;
    let s = (await q('select title, big_question from sessions where id=$1', [id]))[0];
    if (!s) s = (await q('select title, big_question from sessions where slug=$1', [id]))[0];
    const question = (s && s.big_question) || (s && s.title) || 'Story Map';
    return {
      title: question + ' · Story Map',
      openGraph: {
        title: question,
        description: 'See where different stories land on the map.',
      },
    };
  } catch { return {}; }
}

export default function Page({ params }) {
  return <MapView id={params.id} />;
}
