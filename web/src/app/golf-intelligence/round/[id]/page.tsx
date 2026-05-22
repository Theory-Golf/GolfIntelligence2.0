export default async function RoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        color: 'var(--foreground)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: 'var(--font-mono)',
      }}
    >
      <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--ash)' }}>
        Round {id}
      </p>
      <p style={{ fontSize: 13, color: 'var(--cement)' }}>
        Shot entry coming in Phase 3
      </p>
    </div>
  );
}
