export default function StatusBadge({ status }) {
  const cls = `status-badge status-${status.replaceAll(' ', '-')}`;
  return <span className={cls}>{status}</span>;
}
