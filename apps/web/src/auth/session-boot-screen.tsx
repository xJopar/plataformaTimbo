export function SessionBootScreen(): React.JSX.Element {
  return (
    <main className="session-boot-screen" aria-busy="true">
      <header className="session-boot-header">
        <img src="/marca/logotipo-timbo-blanco-transparente.png" alt="Timbo" />
        <span>Plataforma</span>
      </header>
      <section className="session-boot-content" aria-label="Verificando sesión" role="status">
        <span className="session-boot-indicator" aria-hidden="true" />
        <div>
          <h1>Preparando tu espacio de trabajo</h1>
          <p>Verificando tu sesión segura.</p>
        </div>
      </section>
    </main>
  );
}
