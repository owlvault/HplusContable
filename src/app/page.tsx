
import Link from 'next/link';

export default function Home() {
  return (
    <main className="container" style={{ paddingTop: '4rem' }}>
      <section className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'hsl(var(--primary))' }}>
          DigiKawsay
        </h1>
        <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '2rem', fontSize: '1.125rem' }}>
          La nueva era de la contabilidad inteligente en Colombia.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="/puc" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Iniciar Sesión
          </Link>
          <button className="btn" style={{ backgroundColor: 'transparent', border: '1px solid hsl(var(--border))' }}>
            Más Información
          </button>
        </div>
      </section>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <span style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))' }}>
          Powered by H Plus & AI
        </span>
      </div>
    </main>
  );
}
