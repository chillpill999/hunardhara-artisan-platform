import { SEED_PRODUCTS, fetchProductById } from "@/lib/api";
import CraftDetailClient from "@/components/CraftDetailClient";

export function generateStaticParams() {
  return SEED_PRODUCTS.map((p) => ({ id: p.id }));
}

export default async function CraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await fetchProductById(id);

  return <CraftDetailClient initialProduct={product} id={id} />;
}
