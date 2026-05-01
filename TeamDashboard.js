import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TeamDashboard = () => {
    const navigate = useNavigate();
    const [weeklyTasks, setWeeklyTasks] = useState([]);
    const [ongoingTasks, setOngoingTasks] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const now = new Date();
                const nextWeek = new Date(now);
                nextWeek.setDate(now.getDate() + 7);

                // --- Week Range calculation ---
                const dayOfWeek = now.getDay();
                const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() + diffToMonday);
                startOfWeek.setHours(0, 0, 0, 0);

                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);

                // --- Fetch data ---
                const listResp = await fetch('http://localhost:8000/gantt/list');
                const projects = await listResp.json();

                let allTasks = [];
                const EXCLUDED_GROUPS = ["Gros Œuvre", "Second Œuvre", "Finitions", "Extérieurs & Piscine"];

                for (const proj of projects) {
                    const detailResp = await fetch(`http://localhost:8000/gantt/${proj.id}`);
                    const detail = await detailResp.json();

                    if (detail.json_data && detail.json_data.data) {
                        // Create a lookup for parent names *within this project*
                        const taskMap = {};
                        detail.json_data.data.forEach(t => {
                            taskMap[t.id] = t.text;
                        });

                        const projectTasks = detail.json_data.data.map(task => ({
                            ...task,
                            projectName: proj.project_name,
                            parentName: taskMap[task.parent] || null
                        }));
                        allTasks = [...allTasks, ...projectTasks];
                    }
                }

                // --- Filter: Weekly Planning ---
                const weekly = allTasks.filter(task => {
                    // 1. Exclude the groups themselves
                    if (EXCLUDED_GROUPS.includes(task.text)) return false;

                    // 2. Task intersection logic
                    if (!task.start_date || !task.duration) return false;
                    const taskStart = new Date(task.start_date);
                    const taskEnd = new Date(taskStart);
                    taskEnd.setDate(taskStart.getDate() + task.duration);
                    return taskStart <= endOfWeek && taskEnd >= startOfWeek;
                }).map(task => {
                    const taskStart = new Date(task.start_date);
                    const taskEnd = new Date(taskStart);
                    taskEnd.setDate(taskStart.getDate() + task.duration);

                    // Append parent name if it exists and is not a generic project root
                    const displayName = task.parentName ? `${task.text} (${task.parentName})` : task.text;
                    return { ...task, text: displayName, taskEnd };
                });

                weekly.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
                setWeeklyTasks(weekly);

                // --- Filter: Ongoing Tasks (Mes Tâches) with Urgency Logic ---
                const ongoing = allTasks.filter(task => {
                    // 1. Exclude the groups themselves
                    if (EXCLUDED_GROUPS.includes(task.text)) return false;

                    // 2. Task activity logic
                    if (!task.start_date || !task.duration) return false;
                    const taskStart = new Date(task.start_date);
                    const taskEnd = new Date(taskStart);
                    taskEnd.setDate(taskStart.getDate() + task.duration);
                    return now >= taskStart && now <= taskEnd && (task.progress || 0) < 1;
                }).map(task => {
                    const taskStart = new Date(task.start_date);
                    const taskEnd = new Date(taskStart);
                    taskEnd.setDate(taskStart.getDate() + task.duration);
                    const totalTime = taskEnd - taskStart;
                    const timeElapsed = now - taskStart;
                    const timeRatio = totalTime > 0 ? timeElapsed / totalTime : 0;
                    const progress = task.progress || 0;
                    const urgencyScore = timeRatio - progress;
                    let urgencyStatus = 'low';
                    if (urgencyScore > 0.15) urgencyStatus = 'high';
                    else if (urgencyScore > 0.05 || timeRatio > 0.8) urgencyStatus = 'medium';

                    const displayName = task.parentName ? `${task.text} (${task.parentName})` : task.text;
                    return { ...task, text: displayName, urgencyScore, urgencyStatus, taskEnd };
                });

                // Sort by urgency score descending, then by end date
                ongoing.sort((a, b) => b.urgencyScore - a.urgencyScore);
                setOngoingTasks(ongoing);

                // --- Generate: Automated Announcements ---
                const newAnnouncements = [];

                allTasks.forEach(task => {
                    const taskStart = new Date(task.start_date);
                    const taskEnd = new Date(taskStart);
                    taskEnd.setDate(taskStart.getDate() + task.duration);

                    // 1. Critical Delay
                    const totalTime = taskEnd - taskStart;
                    const timeElapsed = now - taskStart;
                    const timeRatio = totalTime > 0 ? timeElapsed / totalTime : 0;
                    const urgency = timeRatio - (task.progress || 0);

                    if (urgency > 0.15 && (task.progress || 0) < 1) {
                        newAnnouncements.push({
                            type: 'delay',
                            title: 'Retard détecté',
                            projectName: task.projectName,
                            text: `La tâche "${task.text}" accuse un retard critique.`,
                            date: now,
                            color: '#ef4444'
                        });
                    }

                    // 2. Phase ending soon (next 7 days)
                    if (task.type === 'project' && taskEnd > now && taskEnd <= nextWeek && (task.progress || 0) < 1) {
                        newAnnouncements.push({
                            type: 'deadline',
                            title: 'Fin de phase proche',
                            projectName: task.projectName,
                            text: `La phase "${task.text}" se termine le ${taskEnd.toLocaleDateString()}.`,
                            date: taskEnd,
                            color: '#4f46e5'
                        });
                    }

                    // 3. Phase completed
                    if (task.type === 'project' && task.progress === 1) {
                        newAnnouncements.push({
                            type: 'success',
                            title: 'Phase terminée',
                            projectName: task.projectName,
                            text: `Bravo ! La phase "${task.text}" est maintenant finalisée.`,
                            date: now,
                            color: '#10b981'
                        });
                    }
                });

                // Deduplicate and Sort (latest first, but delays on top)
                const sortedAnnouncements = newAnnouncements
                    .filter((v, i, a) => a.findIndex(t => (t.text === v.text && t.projectName === v.projectName)) === i)
                    .sort((a, b) => {
                        if (a.type === 'delay' && b.type !== 'delay') return -1;
                        if (b.type === 'delay' && a.type !== 'delay') return 1;
                        return b.date - a.date;
                    })
                    .slice(0, 5); // Max 5 announcements

                setAnnouncements(sortedAnnouncements);

                // --- Génération: Dynamique des Resources ---
                const TASK_RESOURCES = {
                    "Implantation et terrassement": { title: "Le terrassement et les fondations", type: "PDF", link: "https://ajbtp.com/wp-content/uploads/2024/10/Cours-Traitement-des-Sols-et-fondations.pdf?utm_source=perplexity" },
                    "Fondations": { title: "Les fondations superficielles", type: "Norme", link: "https://orbi.uliege.be/bitstream/2268/61649/18/Chapitre%207%20R%C3%A8gles%20g%C3%A9n%20analyse%20EC8.pdf?utm_source=perplexity" },
                    "Assainissement / VRD": { title: "Assainissement non collectif", type: "Loi", link: "https://www.ecologie.gouv.fr/assainissement-non-collectif" },
                    "Soubassement": { title: "Types de soubassement", type: "Guide", link: "https://www.travaux.com/maconnerie/guides/les-differents-types-de-soubassement" },
                    "Dallage": { title: "DTU 13.3 - Dallages en béton", type: "Norme", link: "https://www.batirama.com/article/813-le-dtu-13.3-regit-les-dallages-en-beton.html" },
                    "Élévation des murs": { title: "DTU 20.1 - Maçonnerie", type: "Norme", link: "https://www.expert-construction.org/regles-de-lart/dtu-20-1-maconnerie/" },
                    "Charpente": { title: "Le guide de la charpente bois", type: "Guide", link: "https://www.codifab.fr/ressources/le-guide-de-la-charpente-bois" },
                    "Couverture / Zinguerie": { title: "DTU 40.1 & 40.2 - Tuiles", type: "Norme", link: "https://www.batirama.com/article/1179-le-dtu-40.1-et-40.2-couverture-en-tuiles.html" },
                    "Menuiseries extérieures": { title: "Règles de l'art Menuiseries", type: "Guide", link: "https://www.ufme.fr/regles-de-lart-et-documentation-technique" },
                    "Isolation / Plâtrerie": { title: "Isolation des murs (Intérieur)", type: "Guide", link: "https://www.isover.fr/guides/isolation-des-murs-par-linterieur" },
                    "Electricité (incorporation)": { title: "Norme NF C 15-100", type: "Norme", link: "https://www.promotelec.com/professionnels/norme-nf-c-15-100/" },
                    "Plomberie (incorporation)": { title: "Réseau évacuation (Conseils)", type: "Docs", link: "https://www.plomberie-pro.com/Conseils/reseau-evacuation.htm" },
                    "Chape": { title: "Les différents types de chape", type: "Docs", link: "https://www.infociments.fr/chapes/les-differents-types-de-chape" },//here
                    "Revêtements de sols": { title: "DTU 52.1 - Sols scellés", type: "Norme", link: "https://www.pointp.fr/conseils-experts/tout-savoir-sur-le-dtu-52-1-revetements-de-sol-scelles" },
                    "Peinture / Décoration": { title: "Règles DTU 59.1 (Peinture)", type: "Norme", link: "https://www.tollens.com/conseils-experts/tout-sur-le-dtu-59-1" },
                    "Equipements (Cuisine, Sanitaires)": { title: "Électricité Cuisine (NF C 15-100)", type: "Norme", link: "https://www.installation-renovation-electrique.com/norme-electrique-cuisine-nf-c-15-100/" },
                    "Terrasse extérieure": { title: "Construction terrasse béton", type: "Guide", link: "https://www.toutsurlebeton.fr/maison/terrasse-beton/" },
                    "Jardin paysagé": { title: "Votre Jardin (Conseils)", type: "Guide", link: "https://www.unep-lesentreprisesdupaysage.fr/votre-jardin/" },
                    "Dépendance / Garage": { title: "Règles Urbanisme Garage", type: "Loi", link: "https://www.architecte-paca.com/regles-urbanisme/construire-un-garage/" },
                    "Domotique": { title: "Maison connectée (Conseils)", type: "Guide", link: "https://www.promotelec.com/particuliers/fiches-conseils/la-domotique-pour-une-maison-connectee/" },
                    "Panneaux solaires": { title: "Infos Photovoltaïque", type: "Portail", link: "https://www.photovoltaique.info/fr/" }
                };

                const PHASE_RESOURCES = {
                    "Gros Œuvre": [
                        { title: "Guide Sécurité (Maçonnerie) - INRS", type: "Docs", link: "https://portaildocumentaire.inrs.fr/Default/doc/SYRACUSE/152327/guide-de-securite-pour-les-travaux-de-couverture?_lg=fr-FR&utm_source=perplexity" },
                        { title: "Guide Échafaudages de pied", type: "PDF", link: "https://memoforma.fr/montage-utilisation-et-demontage-des-echafaudages-conforme-a-la-recommandation-de-la-cnam-r-408-pour-les-echafaudages-de-pied/?utm_source=perplexity" }
                    ],
                    "Extérieurs & Piscine": [
                        { title: "Sécurité Bassins & Périphérie", type: "Loi", link: "https://www.maif.fr/conseils-prevention/la-vie-quotidienne/maison/securite-piscine" },//
                        { title: "Étanchéité Piscine (guide-piscine)", type: "Guide", link: "https://www.guide-piscine.fr/" },
                        { title: "Étanchéité Piscine (reflex-boutique)", type: "Guide", link: "https://reflex-boutique.fr/content/192-rendre-etanche-piscine" }//
                    ]
                };

                let suggestedResources = [
                    { title: "Prévention BTP (Général)", type: "Portail", link: "https://www.fiducial.fr/Batiment/WINBAT-Pro-et-Expert/Securite-des-chantiers-regles-obligations-et-bonnes-pratiques?utm_source=perplexity", isGeneral: true }
                ];

                const activeTaskNames = new Set();
                const activePhases = new Set();

                [...weekly, ...ongoing].forEach(t => {
                    // Extract base name from "Task (Parent)"
                    const baseName = t.text.split(' (')[0];
                    activeTaskNames.add(baseName);
                    if (t.parentName) activePhases.add(t.parentName);
                });

                // Add task-specific resources
                activeTaskNames.forEach(name => {
                    if (TASK_RESOURCES[name]) {
                        suggestedResources.push(TASK_RESOURCES[name]);
                    }
                });

                // Add phase-specific resources
                activePhases.forEach(phase => {
                    if (PHASE_RESOURCES[phase]) {
                        suggestedResources = [...suggestedResources, ...PHASE_RESOURCES[phase]];
                    }
                });

                // Deduplicate and limit
                const uniqueResources = suggestedResources.filter((v, i, a) => a.findIndex(t => t.link === v.link) === i);
                setResources(uniqueResources.slice(0, 8));

            } catch (err) {
                console.error("Dashboard error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const getUrgencyColor = (status) => {
        switch (status) {
            case 'high': return '#ef4444'; // Red
            case 'medium': return '#f59e0b'; // Orange
            default: return '#10b981'; // Green
        }
    };

    return (
        <div style={containerStyle}>
            <header style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>Espace Équipe Opérationnelle</h1>
                    <p style={subtitleStyle}>Bienvenue sur votre tableau de bord de suivi</p>
                </div>
                <button onClick={handleLogout} style={logoutBtnStyle}>
                    Déconnexion
                </button>
            </header>

            <main style={mainStyle}>
                <div style={{ ...gridStyle, gridTemplateColumns: '1fr 2fr' }}>
                    {/* Ongoing Tasks Section */}
                    <div style={cardStyle}>
                        <div style={cardHeaderStyle}>
                            <h2 style={cardTitleStyle}>Mes Tâches en Cours</h2>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>Trié par urgence réelle</p>
                        </div>

                        <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                            {loading ? (
                                <p style={cardContentStyle}>Chargement...</p>
                            ) : ongoingTasks.length === 0 ? (
                                <p style={cardContentStyle}>Aucune tâche active n'est à traiter pour le moment.</p>
                            ) : (
                                ongoingTasks.map((task, idx) => (
                                    <div key={idx} style={{
                                        marginBottom: '16px',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        borderLeft: `6px solid ${getUrgencyColor(task.urgencyStatus)}`,
                                        background: '#f8fafc',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>{task.text}</h3>
                                            <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600 }}>{task.projectName}</span>
                                        </div>

                                        <div style={{ marginTop: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                                <span style={{ color: '#64748b' }}>Progression</span>
                                                <span style={{ fontWeight: 700, color: '#334155' }}>{Math.round((task.progress || 0) * 100)}%</span>
                                            </div>
                                            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${(task.progress || 0) * 100}%`,
                                                    height: '100%',
                                                    background: getUrgencyColor(task.urgencyStatus),
                                                    borderRadius: '3px'
                                                }} />
                                            </div>
                                        </div>

                                        {task.urgencyStatus === 'high' && (
                                            <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>
                                                ⚠️ Retard critique détecté
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Weekly Planning Section */}
                    <div style={{ ...cardStyle }}>
                        <div style={cardHeaderStyle}>
                            <h2 style={cardTitleStyle}>Planning de la semaine</h2>
                        </div>
                        {loading ? (
                            <p style={cardContentStyle}>Chargement du planning...</p>
                        ) : weeklyTasks.length === 0 ? (
                            <p style={cardContentStyle}>Aucune tâche prévue pour cette semaine.</p>
                        ) : (
                            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                            <th style={thStyle}>Début</th>
                                            <th style={thStyle}>Fin</th>
                                            <th style={thStyle}>Tâche</th>
                                            <th style={thStyle}>Projet</th>
                                            <th style={thStyle}>Durée</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weeklyTasks.map((task, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                <td style={tdStyle}>{task.start_date ? new Date(task.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '-'}</td>
                                                <td style={{ ...tdStyle, color: '#64748b' }}>{task.taskEnd?.toLocaleDateString ? task.taskEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '-'}</td>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>{task.text}</td>
                                                <td style={{ ...tdStyle, color: '#6366f1' }}>{task.projectName}</td>
                                                <td style={tdStyle}>{task.duration} j</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div style={gridStyle}>
                    <div style={cardStyle}>
                        <div style={cardHeaderStyle}>
                            <h2 style={cardTitleStyle}>Documents & Ressources</h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {loading ? (
                                <p style={cardContentStyle}>Chargement...</p>
                            ) : resources.map((res, idx) => (
                                <a key={idx} href={res.link} target="_blank" rel="noopener noreferrer" style={{
                                    textDecoration: 'none',
                                    padding: '12px',
                                    background: '#f8fafc',
                                    borderRadius: '10px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.2s',
                                    hover: { background: '#f1f5f9' }
                                }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>{res.type}</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginTop: '4px' }}>{res.title}</span>
                                </a>
                            ))}
                        </div>
                    </div>

                    <div style={newsSectionStyle}>
                        <h2 style={sectionTitleStyle}>Annonces récentes</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {loading ? (
                                <p style={cardContentStyle}>Chargement...</p>
                            ) : announcements.length === 0 ? (
                                <div style={newsItemStyle}>
                                    <p style={newsTextStyle}>Aucun événement récent à signaler.</p>
                                </div>
                            ) : (
                                announcements.map((ann, idx) => (
                                    <div key={idx} style={{ ...newsItemStyle, borderLeft: `4px solid ${ann.color}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ ...newsDateStyle, color: ann.color }}>{ann.title} • {ann.projectName}</span>
                                        </div>
                                        <p style={newsTextStyle}>{ann.text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

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
                                Êtes-vous sûr de vouloir quitter votre espace équipe ?
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

const thStyle = {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const tdStyle = {
    padding: '12px 16px',
    fontSize: '0.9rem',
    color: '#334155'
};

const containerStyle = {
    padding: '40px',
    fontFamily: "'Inter', sans-serif",
    background: '#f1f5f9',
    minHeight: '100vh',
    color: '#0f172a'
};

const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
    background: 'white',
    padding: '24px 32px',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
};

const titleStyle = {
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#1e293b'
};

const subtitleStyle = {
    margin: '4px 0 0 0',
    color: '#64748b',
    fontSize: '0.95rem'
};

const logoutBtnStyle = {
    padding: '10px 20px',
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.2s'
};

const mainStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px'
};

const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px'
};

const cardStyle = {
    background: 'white',
    padding: '24px',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.2s',
    cursor: 'default'
};

const cardHeaderStyle = {
    borderBottom: '1px solid #f1f5f9',
    marginBottom: '16px',
    paddingBottom: '12px'
};

const cardTitleStyle = {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#334155'
};

const cardContentStyle = {
    margin: 0,
    color: '#64748b',
    lineHeight: 1.6
};

const newsSectionStyle = {
    gridColumn: 'span 2'
};

const sectionTitleStyle = {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '20px'
};

const newsItemStyle = {
    background: 'linear-gradient(to right, #ffffff, #f8fafc)',
    padding: '20px',
    borderRadius: '12px',
    borderLeft: '4px solid #4f46e5',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const newsDateStyle = {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#4f46e5',
    textTransform: 'uppercase'
};

const newsTextStyle = {
    margin: '8px 0 0 0',
    color: '#334155',
    fontWeight: 500
};

export default TeamDashboard;

