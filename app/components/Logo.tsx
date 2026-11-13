export default function Logo({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="currentColor" opacity=".12"/><path d="M16 27V13M16 13C16 8 12 5 7 5c0 5 3 8 9 8zM16 17c0-4 3-7 9-7 0 5-3 8-9 8z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
