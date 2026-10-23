/** Consulta por ronquido fuerte (LANGUAGE «Salud y privacidad»): sin diagnóstico, sin medicación, sin datos de salud. */
export function ConsultaCard() {
  return (
    <section aria-labelledby="consulta-titulo" className="space-y-2 border-t border-line pt-6">
      <h2 id="consulta-titulo" className="text-section font-semibold">Si te dicen que roncas fuerte</h2>
      <p className="max-w-prose text-body">
        Un ronquido fuerte que otra persona nota merece una consulta con un profesional de salud. Relevo no diagnostica ni recomienda medicamentos.
      </p>
      <p className="max-w-prose text-aux text-muted-foreground">
        Pedir esa consulta no depende de que esta aplicación funcione. Relevo no guarda datos de salud ni de sueño.
      </p>
    </section>
  );
}
