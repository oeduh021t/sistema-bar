import React, { createContext, useState, useEffect, useContext } from 'react';

interface AuthContextType {
  token: string | null;
  usuario: { nome: string; funcao: string } | null;
  login: (token: string, usuario: { nome: string; funcao: string }) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<{ nome: string; funcao: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storagedToken = localStorage.getItem('@SistemaBar:token');
    const storagedUser = localStorage.getItem('@SistemaBar:usuario');

    if (storagedToken && storagedUser) {
      setToken(storagedToken);
      setUsuario(JSON.parse(storagedUser));
    }
    setLoading(false);
  }, []);

  const login = (novoToken: string, novoUsuario: { nome: string; funcao: string }) => {
    setToken(novoToken);
    setUsuario(novoUsuario);
    localStorage.setItem('@SistemaBar:token', novoToken);
    localStorage.setItem('@SistemaBar:usuario', JSON.stringify(novoUsuario));
  };

  const logout = () => {
    setToken(null);
    setUsuario(null);
    localStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ token, usuario, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
