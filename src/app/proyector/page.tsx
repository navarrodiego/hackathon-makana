import { ProyectorView } from "@/components/proyector/proyector-view";
import { Qr } from "@/components/proyector/qr";
import { SurfaceShell } from "@/components/relevo/surface-shell";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SurfaceShell surface="projector" title="Proyector">
      <ProyectorView qr={<Qr />} />
    </SurfaceShell>
  );
}
