'use client';
import { useEffect, useState } from 'react';

export default function BrandBar({ right }) {
  const [test, setTest] = useState(false);
  useEffect(() => {
    setTest(document.cookie.split(';').some((c) => c.trim() === 'sm_test=1'));
  }, []);
  return (
    <div className="brandbar">
      <a className="brand" href="/"><img src="/symbol.png" alt="" />Story Map</a>
      {test && <span className="test-badge">TEST MODE</span>}
      {right || null}
    </div>
  );
}
