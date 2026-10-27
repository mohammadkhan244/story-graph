export default function BrandBar({ right }) {
  return (
    <div className="brandbar">
      <a className="brand" href="/"><img src="/symbol.png" alt="" />Story Map</a>
      {right || null}
    </div>
  );
}
