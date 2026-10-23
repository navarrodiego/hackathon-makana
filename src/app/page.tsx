export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center px-6 py-16 sm:px-10">
      <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance">Relevo</h1>
      <p className="mt-4 text-lg">Entrega el turno. Recupera la noche.</p>
      <section aria-labelledby="estado" className="mt-12 border-t border-border pt-8">
        <h2 id="estado" className="text-lg font-semibold text-balance">Base técnica inicializada</h2>
        <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
          El recorrido de relevo todavía no está implementado. Esta pantalla no registra reportes ni confirma cobertura.
        </p>
      </section>
    </main>
  );
}
