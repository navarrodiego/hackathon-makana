import { ProyectorView } from "@/components/proyector/proyector-view";
import { canalQr } from "@/components/proyector/qr";
import { SurfaceShell } from "@/components/relevo/surface-shell";

export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <SurfaceShell surface="projector" title="Proyector de Relevo" titleHidden>
      <ProyectorView qr={await canalQr()} />
    </SurfaceShell>
  );
}
