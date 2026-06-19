import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { useEffect, useState } from "react";

import { auth } from "../lib/firebase";

interface AuthGateProps {
  children: (user: User) => React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAnonymousSignIn = async () => {
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion.");
    }
  };

  if (loading) {
    return <div className="centered-shell">Cargando sesion...</div>;
  }

  if (!user) {
    return (
      <div className="centered-shell">
        <h1 className="title">Habitro</h1>
        <p className="muted">No hay sesion activa. Para MVP puedes entrar con sesion anonima.</p>
        <button className="primary-btn" type="button" onClick={handleAnonymousSignIn}>
          Continuar
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    );
  }

  return <>{children(user)}</>;
}
