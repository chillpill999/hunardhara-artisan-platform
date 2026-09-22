import { fetchProductById, fetchProducts } from "@/lib/api";
import CraftDetailClient from "@/components/CraftDetailClient";

export async function generateStaticParams() {
  try {
    const products = await fetchProducts();
    if (products && products.length > 0) {
      return products.map((p) => ({ id: p.id }));
    }
  } catch {
    // Build time static export
  }
  return [{ id: 'overview' }];
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
