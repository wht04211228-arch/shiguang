import { redirect } from "next/navigation";

export default async function LegacyPaymentProofPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pay/manual/${id}`);
}
