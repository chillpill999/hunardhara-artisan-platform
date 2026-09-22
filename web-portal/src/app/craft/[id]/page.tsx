import { fetchProductById } from "@/lib/api";
import CraftDetailClient from "@/components/CraftDetailClient";

export async function generateStaticParams() {
  return [
    { id: 'prod-001' },
    { id: 'prod-002' },
    { id: 'prod-003' },
    { id: 'prod-004' },
    { id: 'prod-005' },
    { id: 'prod-varanasi-001' },
    { id: 'prod-bastar-001' },
    { id: 'prod-bastar-002' },
    { id: 'prod-khurja-001' },
    { id: 'prod-madhubani-001' },
    { id: 'prod-channapatna-001' },
  ];
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
