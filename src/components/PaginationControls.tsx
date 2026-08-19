export function PaginationControls({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
      <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => onChange(page - 1)} disabled={page === 0}>
        ‹ Prev
      </button>
      <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>Page {page + 1} of {totalPages}</span>
      <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => onChange(page + 1)} disabled={page === totalPages - 1}>
        Next ›
      </button>
    </div>
  );
}
