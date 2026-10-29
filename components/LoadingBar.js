'use client';
import { useEffect, useRef, useState } from 'react';

export default function LoadingBar({ stages }) {
  const [pct, setPct] = useState(0);
  const [si, setSi] = useState(0);
  const tidRef = useRef(null);

  useEffect(() => {
    let current = 0;
    let stageI = 0;

    function runStage() {
      if (stageI >= stages.length) return;
      const s = stages[stageI];
      const steps = Math.max(1, Math.ceil(s.duration / 40));
      const delta = (s.target - current) / steps;
      let stepCount = 0;

      tidRef.current = setInterval(() => {
        stepCount++;
        current = Math.min(s.target, current + delta);
        setPct(Math.round(current));
        setSi(stageI);
        if (stepCount >= steps) {
          clearInterval(tidRef.current);
          stageI++;
          runStage();
        }
      }, 40);
    }

    runStage();
    return () => clearInterval(tidRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stage = stages[Math.min(si, stages.length - 1)];

  return (
    <div className="lbar">
      <div className="lbar-row">
        <span className="lbar-label">{stage?.label}</span>
        <span className="lbar-pct">{pct}%</span>
      </div>
      <div className="lbar-track">
        <div className="lbar-fill" style={{ width: pct + '%' }} />
      </div>
      {stage?.detail && <p className="lbar-detail">{stage.detail}</p>}
    </div>
  );
}
