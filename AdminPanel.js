import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminPanel = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingApproved, setLoadingApproved] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [editingProject, setEditingProject] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [userToReject, setUserToReject] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'projects'
    const navigate = useNavigate();

    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().slice(0, 16);
        } catch (e) {
            return '';
        }
    };

    useEffect(() => {
        const fetchPendingUsers = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:8000/admin/pending-users', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setPendingUsers(data);
                } else {
                    setError('Erreur lors de la récupération des utilisateurs');
                }
            } catch (err) {
                setError('Impossible de contacter le serveur');
            } finally {
                setLoadingUsers(false);
            }
        };

        const fetchApprovedUsers = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:8000/admin/approved-users', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setApprovedUsers(data);
                } else {
                    setError('Erreur lors de la récupération des utilisateurs approuvés');
                }
            } catch (err) {
                setError('Impossible de contacter le serveur');
            } finally {
                setLoadingApproved(false);
            }
        };

        const fetchProjects = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:8000/admin/projects', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setProjects(data);
                } else {
                    setError('Erreur lors de la récupération des projets');
                }
            } catch (err) {
                setError('Impossible de contacter le serveur');
            } finally {
                setLoadingProjects(false);
            }
        };

        fetchPendingUsers();
        fetchApprovedUsers();
        fetchProjects();
    }, []);

    const handleApprove = async (userId) => {
        setError('');
        setSuccess('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/admin/approve/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const approvedUser = pendingUsers.find(user => user.id === userId);
                if (approvedUser) {
                    setApprovedUsers([...approvedUsers, approvedUser]);
                }
                setPendingUsers(pendingUsers.filter(user => user.id !== userId));
                setSuccess("Vous avez approuvé(e) une demande d'inscription");
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError("Erreur lors de l'approbation de la demande");
            }
        } catch (err) {
            setError("Erreur lors de l'approbation de la demande");
        }
    };

    const handleReject = (userId) => {
        setUserToReject(userId);
    };

    const confirmReject = async () => {
        if (!userToReject) return;

        const userId = userToReject;
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/admin/reject/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setPendingUsers(pendingUsers.filter(user => user.id !== userId));
                setSuccess("Vous avez rejeté(e) une demande d'inscription");
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError("Erreur lors du rejet de la demande");
            }
        } catch (err) {
            setError("Erreur lors du rejet de la demande");
        } finally {
            setUserToReject(null);
        }
    };

    const handleDeleteUser = (userId) => {
        setUserToDelete(userId);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;

        const userId = userToDelete;
        try {
            const token = localStorage.getItem('token');
            const url = `http://localhost:8000/admin/delete-approved-user/${userId}`;
            console.log("Appel DELETE sur:", url);

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setApprovedUsers(approvedUsers.filter(user => user.id !== userId));
                setSuccess("Utilisateur licencié avec succès");
                setTimeout(() => setSuccess(''), 5000);
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert('Erreur lors de la suppression de l\'utilisateur : ' + (errorData.detail || response.statusText));
            }
        } catch (err) {
            alert('Erreur serveur lors de la suppression');
        } finally {
            setUserToDelete(null);
        }
    };

    const handleDeleteProject = (projectId) => {
        setProjectToDelete(projectId);
    };

    const confirmDeleteProject = async () => {
        if (!projectToDelete) return;

        const projectId = projectToDelete;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/admin/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setProjects(projects.filter(p => p.id !== projectId));
            } else {
                alert('Erreur lors de la suppression du projet');
            }
        } catch (err) {
            alert('Erreur serveur');
        } finally {
            setProjectToDelete(null);
        }
    };

    const handleUpdateProject = async () => {
        console.log("Attempting to update project:", editingProject);
        if (!editingProject || !editingProject.id) {
            console.error("No project or ID to update");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const url = `http://localhost:8000/admin/projects/${editingProject.id}`;
            console.log("PUT request to:", url);

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    project_name: editingProject.project_name,
                    created_at: editingProject.created_at,
                    description: editingProject.description
                })
            });

            console.log("Response status:", response.status);

            if (response.ok) {
                setProjects(projects.map(p => p.id === editingProject.id ? editingProject : p));
                setEditingProject(null);
                alert('Projet mis à jour avec succès');
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error("Update failed:", errorData);
                alert('Erreur lors de la mise à jour: ' + (errorData.detail || response.statusText));
            }
        } catch (err) {
            console.error("Fetch error:", err);
            alert('Erreur serveur lors de la mise à jour');
        }
    };

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    return (
        <div style={{
            padding: '40px',
            fontFamily: "'Inter', sans-serif",
            background: '#f8fafc',
            minHeight: '100vh'
        }}>
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '40px'
            }}>
                <div>
                    <h1 style={{ color: '#1e293b', fontSize: '2rem', fontWeight: 700, margin: 0 }}>
                        Tableau de Bord Admin
                    </h1>
                    <p style={{ color: '#64748b', marginTop: '8px' }}>
                        Gérez les inscriptions des utilisateurs et projets
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    style={{
                        padding: '10px 20px',
                        background: 'white',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = '#fef2f2';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'white';
                    }}
                >
                    Déconnexion
                </button>
            </header>

            {error && (
                <div style={{
                    padding: '16px',
                    background: '#fef2f2',
                    color: '#ef4444',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    fontWeight: 500
                }}>
                    {error}
                </div>
            )}

            {success && (
                <div style={{
                    padding: '16px',
                    background: '#f0fdf4',
                    color: '#166534',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    fontWeight: 500
                }}>
                    {success}
                </div>
            )}

            {/* Tab Navigation */}
            <nav style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '32px',
                background: '#f1f5f9',
                padding: '6px',
                borderRadius: '14px',
                width: 'fit-content'
            }}>
                <button
                    onClick={() => setActiveTab('pending')}
                    style={{
                        ...tabButtonStyle,
                        backgroundColor: activeTab === 'pending' ? 'white' : 'transparent',
                        color: activeTab === 'pending' ? '#4f46e5' : '#64748b',
                        boxShadow: activeTab === 'pending' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                    }}
                >
                    Demandes en attente
                    {pendingUsers.length > 0 && (
                        <span style={tabBadgeStyle}>{pendingUsers.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('approved')}
                    style={{
                        ...tabButtonStyle,
                        backgroundColor: activeTab === 'approved' ? 'white' : 'transparent',
                        color: activeTab === 'approved' ? '#10b981' : '#64748b',
                        boxShadow: activeTab === 'approved' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                    }}
                >
                    Utilisateurs approuvés
                </button>
                <button
                    onClick={() => setActiveTab('projects')}
                    style={{
                        ...tabButtonStyle,
                        backgroundColor: activeTab === 'projects' ? 'white' : 'transparent',
                        color: activeTab === 'projects' ? '#f59e0b' : '#64748b',
                        boxShadow: activeTab === 'projects' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                    }}
                >
                    Gestion des Projets
                </button>
            </nav>

            <div style={{ minHeight: '400px' }}>
                {/* Pending Users Section */}
                {activeTab === 'pending' && (
                    <section style={sectionStyle}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#334155', margin: 0 }}>
                                Demandes d'inscription en attente
                            </h2>
                        </div>

                        {loadingUsers ? (
                            <div style={loadingStyle}> Chargement... </div>
                        ) : pendingUsers.length === 0 ? (
                            <div style={emptyStyle}> Aucune demande en attente. </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={tableStyle}>
                                    <thead style={{ background: '#f1f5f9' }}>
                                        <tr>
                                            <th style={thStyle}>Nom</th>
                                            <th style={thStyle}>Email</th>
                                            <th style={thStyle}>Rôle</th>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingUsers.map(user => (
                                            <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={tdStyle}>{user.first_name} {user.last_name}</td>
                                                <td style={tdStyle}>{user.email}</td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        ...badgeStyle,
                                                        background: user.role === 'chef' ? '#dcfce7' : '#dbeafe',
                                                        color: user.role === 'chef' ? '#166534' : '#1e40af'
                                                    }}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>{new Date(user.created_at).toLocaleDateString()}</td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button onClick={() => handleApprove(user.id)} style={approveBtnStyle}>
                                                            Approuver
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(user.id)}
                                                            style={{ ...approveBtnStyle, background: '#ef4444' }}
                                                        >
                                                            Rejeter
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* Approved Users Section */}
                {activeTab === 'approved' && (
                    <section style={sectionStyle}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#334155', margin: 0 }}>
                                Utilisateurs approuvés
                            </h2>
                        </div>

                        {loadingApproved ? (
                            <div style={loadingStyle}> Chargement... </div>
                        ) : approvedUsers.length === 0 ? (
                            <div style={emptyStyle}> Aucun utilisateur approuvé. </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={tableStyle}>
                                    <thead style={{ background: '#f1f5f9' }}>
                                        <tr>
                                            <th style={thStyle}>Nom</th>
                                            <th style={thStyle}>Email</th>
                                            <th style={thStyle}>Rôle</th>
                                            <th style={thStyle}>Statut</th>
                                            <th style={thStyle}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {approvedUsers.map(user => (
                                            <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={tdStyle}>{user.first_name} {user.last_name}</td>
                                                <td style={tdStyle}>{user.email}</td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        ...badgeStyle,
                                                        background: user.role === 'admin' ? '#fee2e2' : user.role === 'chef' ? '#dcfce7' : '#dbeafe',
                                                        color: user.role === 'admin' ? '#991b1b' : user.role === 'chef' ? '#166534' : '#1e40af'
                                                    }}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ color: '#166534', fontWeight: 600 }}>Active</span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        style={{ ...approveBtnStyle, background: '#ef4444' }}
                                                    >
                                                        Licencier
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* Projects Section */}
                {activeTab === 'projects' && (
                    <section style={sectionStyle}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#334155', margin: 0 }}>
                                Gestion des Projets Planning
                            </h2>
                        </div>

                        {loadingProjects ? (
                            <div style={loadingStyle}> Chargement... </div>
                        ) : projects.length === 0 ? (
                            <div style={emptyStyle}> Aucun projet trouvé. </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={tableStyle}>
                                    <thead style={{ background: '#f1f5f9' }}>
                                        <tr>
                                            <th style={thStyle}>Nom du Projet</th>
                                            <th style={thStyle}>Description</th>
                                            <th style={thStyle}>Date de création</th>
                                            <th style={thStyle}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {projects.map(project => (
                                            <tr key={project.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>{project.project_name}</td>
                                                <td style={{ ...tdStyle, color: '#64748b' }}>
                                                    {project.description ? (project.description.length > 50 ? project.description.substring(0, 50) + '...' : project.description) : 'No description'}
                                                </td>
                                                <td style={tdStyle}>{new Date(project.created_at).toLocaleDateString()}</td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => handleDeleteProject(project.id)}
                                                            style={{ ...approveBtnStyle, background: '#ef4444' }}
                                                        >
                                                            Supprimer
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* Modal de Modification */}
            {editingProject && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 style={{ marginTop: 0, color: '#1e293b' }}>Modifier le Projet</h3>

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Nom du Projet</label>
                            <input
                                style={inputStyle}
                                value={editingProject.project_name}
                                onChange={(e) => setEditingProject({ ...editingProject, project_name: e.target.value })}
                            />
                        </div>

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Date de création</label>
                            <input
                                type="datetime-local"
                                style={inputStyle}
                                value={formatDateForInput(editingProject.created_at)}
                                onChange={(e) => setEditingProject({ ...editingProject, created_at: e.target.value })}
                            />
                        </div>

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Description</label>
                            <textarea
                                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                                value={editingProject.description}
                                onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button
                                onClick={() => setEditingProject(null)}
                                style={{ ...approveBtnStyle, background: '#94a3b8' }}
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleUpdateProject}
                                style={approveBtnStyle}
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {userToReject && (
                <div className="modal-overlay" onClick={() => setUserToReject(null)} style={{ zIndex: 10001, ...modalOverlayStyle }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', border: 'none', borderRadius: '24px', position: 'relative', overflow: 'visible', padding: 0, background: 'white', margin: 'auto' }}>
                        {/* Red accent bar for rejection */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '24px 24px 0 0' }}></div>

                        <div style={{ padding: '40px 32px' }}>
                            <div style={{
                                width: '80px', height: '80px', backgroundColor: '#fff1f2', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                                fontSize: '40px', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.1)'
                            }}>
                                <span role="img" aria-label="warning">⚠️</span>
                            </div>

                            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '12px', textAlign: 'center', letterSpacing: '-0.02em', border: 'none', marginTop: 0 }}>
                                Rejeter la demande ?
                            </h2>

                            <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px', textAlign: 'center' }}>
                                Êtes-vous sûr de vouloir rejeter cette demande d'inscription ? Cette action est irréversible.
                            </p>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => setUserToReject(null)}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0',
                                        backgroundColor: 'white', color: '#64748b', fontWeight: '700', cursor: 'pointer',
                                        transition: 'all 0.2s', fontSize: '1rem'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmReject}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px', border: 'none',
                                        backgroundColor: '#ef4444', color: 'white', fontWeight: '700', cursor: 'pointer',
                                        boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)', transition: 'all 0.2s',
                                        fontSize: '1rem'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 20px -5px rgba(239, 68, 68, 0.4)'; e.currentTarget.style.backgroundColor = '#dc2626'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(239, 68, 68, 0.3)'; e.currentTarget.style.backgroundColor = '#ef4444'; }}
                                >
                                    Rejeter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {userToDelete && (
                <div className="modal-overlay" onClick={() => setUserToDelete(null)} style={{ zIndex: 10001, ...modalOverlayStyle }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', border: 'none', borderRadius: '24px', position: 'relative', overflow: 'visible', padding: 0, background: 'white', margin: 'auto' }}>
                        {/* Red accent bar for deletion */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '24px 24px 0 0' }}></div>

                        <div style={{ padding: '40px 32px' }}>
                            <div style={{
                                width: '80px', height: '80px', backgroundColor: '#fff1f2', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                                fontSize: '40px', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.1)'
                            }}>
                                <span role="img" aria-label="warning">⚠️</span>
                            </div>

                            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '12px', textAlign: 'center', letterSpacing: '-0.02em', border: 'none', marginTop: 0 }}>
                                Licencier l'utilisateur ?
                            </h2>

                            <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px', textAlign: 'center' }}>
                                Êtes-vous sûr de vouloir supprimer cet utilisateur approuvé ? Cette action supprimera définitivement son accès.
                            </p>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => setUserToDelete(null)}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0',
                                        backgroundColor: 'white', color: '#64748b', fontWeight: '700', cursor: 'pointer',
                                        transition: 'all 0.2s', fontSize: '1rem'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDeleteUser}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px', border: 'none',
                                        backgroundColor: '#ef4444', color: 'white', fontWeight: '700', cursor: 'pointer',
                                        boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)', transition: 'all 0.2s',
                                        fontSize: '1rem'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 20px -5px rgba(239, 68, 68, 0.4)'; e.currentTarget.style.backgroundColor = '#dc2626'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(239, 68, 68, 0.3)'; e.currentTarget.style.backgroundColor = '#ef4444'; }}
                                >
                                    Licencier
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {projectToDelete && (
                <div className="modal-overlay" onClick={() => setProjectToDelete(null)} style={{ zIndex: 10001, ...modalOverlayStyle }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', border: 'none', borderRadius: '24px', position: 'relative', overflow: 'visible', padding: 0, background: 'white', margin: 'auto' }}>
                        {/* Red accent bar for deletion */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '24px 24px 0 0' }}></div>

                        <div style={{ padding: '40px 32px' }}>
                            <div style={{
                                width: '80px', height: '80px', backgroundColor: '#fff1f2', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                                fontSize: '40px', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.1)'
                            }}>
                                <span role="img" aria-label="warning">⚠️</span>
                            </div>

                            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '12px', textAlign: 'center', letterSpacing: '-0.02em', border: 'none', marginTop: 0 }}>
                                Supprimer le projet ?
                            </h2>

                            <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px', textAlign: 'center' }}>
                                Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est définitive et toutes les données associées seront perdues.
                            </p>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => setProjectToDelete(null)}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0',
                                        backgroundColor: 'white', color: '#64748b', fontWeight: '700', cursor: 'pointer',
                                        transition: 'all 0.2s', fontSize: '1rem'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDeleteProject}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px', border: 'none',
                                        backgroundColor: '#ef4444', color: 'white', fontWeight: '700', cursor: 'pointer',
                                        boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)', transition: 'all 0.2s',
                                        fontSize: '1rem'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 20px -5px rgba(239, 68, 68, 0.4)'; e.currentTarget.style.backgroundColor = '#dc2626'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(239, 68, 68, 0.3)'; e.currentTarget.style.backgroundColor = '#ef4444'; }}
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLogoutConfirm && (
                <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)} style={{ zIndex: 10001 }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', border: 'none', borderRadius: '24px', position: 'relative', overflow: 'visible', padding: 0 }}>
                        {/* Red accent bar for logout */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '24px 24px 0 0' }}></div>

                        <div style={{ padding: '40px 32px' }}>
                            <div style={{
                                width: '80px', height: '80px', backgroundColor: '#fff1f2', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                                fontSize: '40px', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.1)'
                            }}>
                                <span role="img" aria-label="logout">❗</span>
                            </div>

                            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '12px', textAlign: 'center', letterSpacing: '-0.02em', border: 'none' }}>
                                Se déconnecter ?
                            </h2>

                            <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px', textAlign: 'center' }}>
                                Êtes-vous sûr de vouloir quitter le panneau d'administration ?
                            </p>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0',
                                        backgroundColor: 'white', color: '#64748b', fontWeight: '700', cursor: 'pointer',
                                        transition: 'all 0.2s', fontSize: '1rem'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    Rester
                                </button>
                                <button
                                    onClick={() => {
                                        setShowLogoutConfirm(false);
                                        localStorage.clear();
                                        navigate('/');
                                    }}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px', border: 'none',
                                        backgroundColor: '#ef4444', color: 'white', fontWeight: '700', cursor: 'pointer',
                                        boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)', transition: 'all 0.2s',
                                        fontSize: '1rem'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 20px -5px rgba(239, 68, 68, 0.4)'; e.currentTarget.style.backgroundColor = '#dc2626'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(239, 68, 68, 0.3)'; e.currentTarget.style.backgroundColor = '#ef4444'; }}
                                >
                                    Déconnexion
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const sectionStyle = {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden'
};

const tableStyle = { width: '100%', borderCollapse: 'collapse' };

const thStyle = {
    textAlign: 'left',
    padding: '16px 24px',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.025em'
};

const tdStyle = {
    padding: '16px 24px',
    fontSize: '0.875rem',
    color: '#0f172a'
};

const badgeStyle = {
    padding: '4px 12px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600
};

const approveBtnStyle = {
    padding: '8px 16px',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500
};

const loadingStyle = { padding: '40px', textAlign: 'center', color: '#64748b' };
const emptyStyle = { padding: '40px', textAlign: 'center', color: '#64748b' };

const tabButtonStyle = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap'
};

const tabBadgeStyle = {
    marginLeft: '8px',
    background: '#ef4444',
    color: 'white',
    fontSize: '0.75rem',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: 700
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000
};

const modalContentStyle = {
    background: 'white',
    padding: '32px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
};

const formGroupStyle = {
    marginBottom: '16px'
};

const labelStyle = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '6px'
};

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box'
};

export default AdminPanel;
