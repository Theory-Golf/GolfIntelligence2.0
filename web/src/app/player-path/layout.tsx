import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PlayerPath',
  description: "Identify each player's highest-leverage improvement areas.",
};

export default function PlayerPathLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
