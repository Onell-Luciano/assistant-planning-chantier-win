import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Register = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        role: 'chef',
        first_name: '',
        last_name: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // Basic validation
        if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
            setError('Veuillez remplir tous les champs obligatoires');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:8000/auth/register-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess('Inscription réussie ! Votre demande est en attente de validation.');
                setTimeout(() => {
                    navigate('/');
                }, 3000);
            } else {
                setError(data.detail || 'Une erreur est survenue lors de l\'inscription');
            }
        } catch (err) {
            console.error('Registration error:', err);
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
            fontFamily: "'Inter', sans-serif",
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 15px rgba(0,0,0,0.03)',
                width: '100%',
                maxWidth: '500px',
                textAlign: 'center'
            }}>
                <h1 style={{
                    margin: '0 0 8px 0',
                    color: '#1e293b',
                    fontSize: '2rem',
                    fontWeight: 700
                }}>Création de compte</h1>
                <p style={{
                    color: '#64748b',
                    marginBottom: '32px',
                    fontSize: '0.95rem'
                }}>Inscrivez-vous pour commencer à planifier</p>

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                Prénom
                            </label>
                            <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="Votre prénom"
                                required
                            />
                        </div>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                Nom
                            </label>
                            <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                style={inputStyle}
                                placeholder="Votre nom"
                                required
                            />
                        </div>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            style={inputStyle}
                            placeholder="votre e-mail"
                            required
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            style={inputStyle}
                            placeholder="Mot de passe"
                            required
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                            Rôle
                        </label>
                        <select
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            style={{
                                ...inputStyle,
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 16px center',
                                backgroundSize: '16px'
                            }}
                        >
                            <option value="chef">Chef de projet</option>
                            <option value="equipe">Équipe opérationnelle</option>
                        </select>
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
                            ...buttonStyle,
                            opacity: loading ? 0.7 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#4338ca')}
                        onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#4f46e5')}
                    >
                        {loading ? 'Inscription en cours...' : "S'inscrire"}
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        style={{
                            background: 'transparent',
                            color: '#6366f1',
                            border: 'none',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginTop: '8px'
                        }}
                    >
                        Déjà un compte ? Se connecter
                    </button>
                </form>
            </div>
        </div>
    );
};

const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '1rem',
    color: '#0f172a',
    outline: 'none',
    transition: 'all 0.2s',
    boxSizing: 'border-box'
};

const buttonStyle = {
    marginTop: '12px',
    width: '100%',
    padding: '14px',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
};

export default Register;
