import { headers } from "next/headers";
import { Channel } from "@/components/canal/channel";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { DegradedNotice } from "@/components/ui/feedback";
import { loadChannelView } from "@/lib/server/messages/view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await loadChannelView((await headers()).get("cookie"));
  // Título solo para lectores de pantalla: en el teléfono el primer paso ya dice qué hacer.
  return (
    <SurfaceShell title="Canal" titleHidden>
      {view ? <Channel view={view} /> : (
        <DegradedNotice title="No se pudo abrir tu sesión del canal">
          <p>No se registró ningún reporte. Recarga la página; si sigue igual, avisa a quien presenta.</p>
        </DegradedNotice>
      )}
    </SurfaceShell>
  );
}
