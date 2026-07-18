export default function OfflineBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="offline-banner" role="status">
      viewer offline — tentando reconectar
    </div>
  );
}
