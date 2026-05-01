import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Helper logic for JWT decoding as a fail-safe
const parseJwt = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('JWT parse error:', e);
        return null;
    }
};

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            console.log('--- LOGIN ATTEMPT ---');
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch('http://localhost:8000/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
            });

            const data = await response.json();
            console.log('Raw response body:', data);

            if (response.ok) {
                setSuccess('Connexion réussie !');

                // Deterministic role extraction
                let userRole = data.role;
                if (!userRole && data.access_token) {
                    console.log('Role missing in body, attempting JWT decode...');
                    const decoded = parseJwt(data.access_token);
                    console.log('Decoded token payload:', decoded);
                    userRole = decoded?.role;
                }

                console.log('Resolved user role:', userRole);

                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('userRole', userRole || '');

                setTimeout(() => {
                    const finalRole = (userRole || '').toLowerCase().trim();
                    console.log('Executing redirection for role:', finalRole);

                    if (finalRole === 'admin') {
                        navigate('/admin');
                    } else if (finalRole === 'equipe') {
                        navigate('/team');
                    } else {
                        navigate('/form');
                    }
                }, 1500);
            } else {
                setError(data.detail || 'Identifiants incorrects');
            }
        } catch (err) {
            console.error('Critical Login Error:', err);
            setError('Impossible de contacter le serveur');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 15px rgba(0,0,0,0.03)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <h1 style={{
                    margin: '0 0 8px 0',
                    color: '#1e293b',
                    fontSize: '2rem',
                    fontWeight: 700
                }}>Bienvenue</h1>
                <p style={{
                    color: '#64748b',
                    marginBottom: '32px',
                    fontSize: '0.95rem'
                }}>Connectez-vous pour accéder au planning</p>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                color: '#0f172a',
                                outline: 'none',
                                transition: 'all 0.2s',
                                boxSizing: 'border-box'
                            }}
                            placeholder="Adresse e-mail"
                            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            required
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                color: '#0f172a',
                                outline: 'none',
                                transition: 'all 0.2s',
                                boxSizing: 'border-box'
                            }}
                            placeholder="Mot de passe"
                            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            required
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '10px',
                            borderRadius: '8px',
                            backgroundColor: '#fef2f2',
                            color: '#ef4444',
                            fontSize: '0.875rem',
                            fontWeight: 500
                        }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{
                            padding: '10px',
                            borderRadius: '8px',
                            backgroundColor: '#f0fdf4',
                            color: '#22c55e',
                            fontSize: '0.875rem',
                            fontWeight: 500
                        }}>
                            {success}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '12px',
                            width: '100%',
                            padding: '14px',
                            background: '#4f46e5',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'background 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
                            opacity: loading ? 0.7 : 1
                        }}
                        onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#4338ca')}
                        onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#4f46e5')}
                    >
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/register')}
                        style={{
                            marginTop: '12px',
                            width: '100%',
                            padding: '14px',
                            background: 'white',
                            color: '#4f46e5',
                            border: '2px solid #4f46e5',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#f5f3ff';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.backgroundColor = 'white';
                        }}
                    >
                        S'inscrire
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
