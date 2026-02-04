import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ name: string }>;
}

export default async function AgentProfileRedirect({ params }: Props) {
  const { name } = await params;
  redirect(`/u/${name}`);
}
