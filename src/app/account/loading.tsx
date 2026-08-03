export default function AccountLoading() {
  return (
    <div aria-label="Loading account" className="animate-pulse" role="status">
      <div className="h-3 w-24 rounded bg-purple/20" />
      <div className="mt-4 h-10 w-52 rounded bg-purple/20" />
      <div className="mt-10 h-48 rounded-2xl bg-white" />
    </div>
  );
}
