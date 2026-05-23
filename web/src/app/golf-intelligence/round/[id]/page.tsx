import { redirect } from 'next/navigation';

export default async function RoundIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/golf-intelligence/round/${id}/hole/1`);
}
