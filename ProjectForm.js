import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProjectForm.css';

const ProjectForm = () => {
    const navigate = useNavigate();

    // --- STATE MANAGEMENT ---
    const [formData, setFormData] = useState({
        // Identity
        projectName: '',
        description: '',
        createdAt: '',
        startDate: new Date().toISOString().split('T')[0],

        // Metrics - Surfaces
        SH: '',         // Surface Habitable
        SD: '',         // Surface Dépendance
        ST: '',         // Surface Toiture

        // Metrics - Exterior
        SE: '',         // Surface Extérieure
        SJ: '',         // Surface Jardin
        SP_bassin: '',  // Surface Piscine (Bassin)
        SP_plage: '',   // Surface Piscine (Plage)

        // Metrics - Constructive
        P: '',          // Pièces
        E: '',          // Étages
        UT: '',         // Unités Techniques

        // Coefficients / Factors
        C: '1.0',           // Complexité
        K: '1.0',           // Crew Factor
        soilFactor: '1.0',  // Coefficient Sol
        finishFactor: '1.0',// Qualité Finitions
        weatherFactor: '1.0',// Météo

        // Optional Planning
        teams: '',       // Nombre d'équipes
        dryingDays: ''   // Jours de séchage
    });

    const [errors, setErrors] = useState({});

    // Sidebar for saved projects
    const [savedProjects, setSavedProjects] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // --- HANDLERS ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.projectName.trim()) newErrors.projectName = "Le nom du projet est requis.";
        if (!formData.startDate) newErrors.startDate = "La date de début est requise.";

        // Basic numeric validation helper
        const checkNum = (field, label, min = 0) => {
            if (formData[field] !== '' && (isNaN(formData[field]) || Number(formData[field]) < min)) {
                newErrors[field] = `${label} invalide.`;
            }
        };

        const checkRequiredNum = (field, label, min = 0) => {
            if (formData[field] === '' || isNaN(formData[field]) || Number(formData[field]) < min) {
                newErrors[field] = `${label} requis.`;
            }
        };

        // SH is likely required for a house project
        checkRequiredNum('SH', 'Surface Habitable', 1);

        // P & E required for structure
        checkRequiredNum('P', 'Nb Pièces', 1);
        checkRequiredNum('E', 'Nb Étages', 0);

        // Others are optional but must be valid if filled
        checkNum('SE', 'Surface Ext.');
        checkNum('SJ', 'Surface Jardin');
        checkNum('SD', 'Surface Dépendance');
        checkNum('ST', 'Surface Toiture');
        checkNum('SP_bassin', 'Surface Bassin');
        checkNum('SP_plage', 'Surface Plage');
        checkNum('UT', 'Unités Tech.');
        checkNum('teams', 'Équipes', 1);
        checkNum('dryingDays', 'Jours séchage');

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const isFormValid = () => {
        return (
            formData.projectName.trim() !== '' &&
            formData.description.trim() !== '' &&
            formData.SH !== '' &&
            formData.P !== '' &&
            formData.E !== ''
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

        const finalData = {
            ...formData,
            createdAt: new Date().toISOString()
        };

        navigate('/gantt', { state: { projectData: finalData } });
    };

    // --- SAVED PROJECTS LOGIC ---
    const fetchSavedProjects = async () => {
        try {
            const res = await fetch("http://localhost:8000/gantt/list");
            const data = await res.json();
            setSavedProjects(data);
        } catch (err) {
            console.error(err);
            alert("Impossible de récupérer la liste des projets.");
        }
    };

    const loadProject = async (id) => {
        try {
            const res = await fetch(`http://localhost:8000/gantt/${id}`);
            const record = await res.json();

            if (record.error) {
                alert("Projet introuvable !");
                return;
            }

            const fullProjectData = record.json_data;
            // Handle import navigation structure
            let navigateData = { importedData: fullProjectData };

            // Back-compat for name
            if (!navigateData.importedData.projectName) {
                navigateData.importedData.projectName = record.project_name;
            }

            navigate('/gantt', { state: navigateData });

        } catch (err) {
            console.error(err);
            alert("Erreur lors du chargement du projet.");
        }
    };

    return (
        <div className="project-form-container">
            <div className="form-header">
                <h2>Configuration du Projet</h2>
                <p>Définissez les paramètres ergonomiques de votre chantier.</p>
            </div>

            <form onSubmit={handleSubmit} className="project-form">

                {/* 1. IDENTITÉ */}
                <div className="form-section">
                    <h3 className="section-title">1. Identité & Planning</h3>
                    <div className="form-grid-3">
                        <div className="form-group full-width" style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="projectName">Nom du projet <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                                type="text"
                                name="projectName"
                                value={formData.projectName}
                                onChange={handleChange}
                                placeholder=""
                            />
                            {errors.projectName && <span className="error">{errors.projectName}</span>}
                        </div>
                        <div className="form-group full-width" style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="description">Description <span style={{ color: '#ef4444' }}>*</span></label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder=""
                                rows="2"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="startDate">Démarrage <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                                type="date"
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                            />
                            {errors.startDate && <span className="error">{errors.startDate}</span>}
                        </div>
                    </div>
                </div>

                {/* 2. SURFACES INTÉRIEURES & STRUCTURE */}
                <div className="form-section">
                    <h3 className="section-title">2. Structure & Intérieur</h3>
                    <div className="form-grid-3">
                        <div className="form-group">
                            <label htmlFor="SH" title="Surface Habitable (chauffée)">Surface Habitable (m²) <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="number" name="SH" value={formData.SH} onChange={handleChange} placeholder="" />
                            {errors.SH && <span className="error">{errors.SH}</span>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="P">Dispositions (Pièces) <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="number" name="P" value={formData.P} onChange={handleChange} placeholder="" />
                            {errors.P && <span className="error">{errors.P}</span>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="E">Niveaux (Étages) <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="number" name="E" value={formData.E} onChange={handleChange} placeholder="" />
                            {errors.E && <span className="error">{errors.E}</span>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="SD">Dépendance / Garage (m²)</label>
                            <input type="number" name="SD" value={formData.SD} onChange={handleChange} placeholder="" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ST">Toiture exploitable (m²)</label>
                            <input type="number" name="ST" value={formData.ST} onChange={handleChange} placeholder="" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="UT" title="Unités Techniques (Points domotiques, prises, caméras)">Unités Techniques (Points)</label>
                            <input type="number" name="UT" value={formData.UT} onChange={handleChange} placeholder="" />
                        </div>
                    </div>
                </div>

                {/* 3. EXTÉRIEURS & PAYSAGE */}
                <div className="form-section">
                    <h3 className="section-title">3. Extérieurs & Piscine</h3>
                    <div className="form-grid-4">
                        <div className="form-group">
                            <label htmlFor="SP_bassin">Piscine (Bassin m²)</label>
                            <input type="number" name="SP_bassin" value={formData.SP_bassin} onChange={handleChange} placeholder="" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="SP_plage">Piscine (Plage m²)</label>
                            <input type="number" name="SP_plage" value={formData.SP_plage} onChange={handleChange} placeholder="" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="SE" title="Terrasses, allées, aménagement dur">Surface Ext. Aménagée (m²)</label>
                            <input type="number" name="SE" value={formData.SE} onChange={handleChange} placeholder="" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="SJ">Jardin Paysagé (m²)</label>
                            <input type="number" name="SJ" value={formData.SJ} onChange={handleChange} placeholder="" />
                        </div>
                    </div>
                </div>

                {/* 4. FACTEURS TECHNIQUES */}
                <div className="form-section">
                    <h3 className="section-title">4. Facteurs & Coefficients</h3>
                    <div className="form-grid-3">
                        <div className="form-group">
                            <label htmlFor="C">Complexité</label>
                            <select name="C" value={formData.C} onChange={handleChange}>
                                <option value="0.8">0.8 - Simple/Cube</option>
                                <option value="1.0">1.0 - Standard</option>
                                <option value="1.2">1.2 - Architecte/Technique</option>
                                <option value="1.5">1.5 - Très Complexe</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="K">Efficacité de l'équipe</label>
                            <select name="K" value={formData.K} onChange={handleChange}>
                                <option value="0.8">0.8 - Petite équipe / Lent</option>
                                <option value="1.0">1.0 - Standard</option>
                                <option value="1.2">1.2 - Rapide / Expérimenté</option>
                                <option value="1.5">1.5 - Grande équipe / Élite</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="soilFactor">Nature du Sol</label>
                            <select name="soilFactor" value={formData.soilFactor} onChange={handleChange}>
                                <option value="1.0">1.0 - Normal / Plat</option>
                                <option value="1.2">1.2 - Rocheux / Pente</option>
                                <option value="1.4">1.4 - Difficile / Accès limité</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="finishFactor">Standing / Finitions</label>
                            <select name="finishFactor" value={formData.finishFactor} onChange={handleChange}>
                                <option value="1.0">1.0 - Standard (Locatif)</option>
                                <option value="1.2">1.2 - Premium (Résidentiel)</option>
                                <option value="1.4">1.4 - Luxe</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="weatherFactor">Conditions Météo</label>
                            <select name="weatherFactor" value={formData.weatherFactor} onChange={handleChange}>
                                <option value="1.0">1.0 - Favorables (Eté/Sud)</option>
                                <option value="1.1">1.1 - Moyennes</option>
                                <option value="1.3">1.3 - Difficiles (Hiver/Pluie)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* ACTION BAR */}
                <div className="form-actions">
                    <button
                        type="submit"
                        className={`submit-btn primary-btn ${!isFormValid() ? 'disabled' : ''}`}
                        disabled={!isFormValid()}
                    >
                        Générer le Planning
                    </button>
                </div>

                <div className="secondary-actions">
                    <div className="divider"><span>Ou</span></div>
                    <div className="action-buttons-row">
                        <button type="button" className="secondary-btn" onClick={() => { setIsSidebarOpen(true); fetchSavedProjects(); }}>
                            Charger un projet
                        </button>
                        <label className="secondary-btn outline-btn">
                            Importer projet
                            <input
                                type="file"
                                accept=".json"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const json = JSON.parse(event.target.result);
                                            if (json.data && Array.isArray(json.data)) {
                                                navigate('/gantt', { state: { importedData: json } });
                                            } else {
                                                alert("Format invalide.");
                                            }
                                        } catch (err) { console.error(err); alert("Erreur lecture JSON."); }
                                    };
                                    reader.readAsText(file);
                                }}
                            />
                        </label>
                    </div>
                </div>

            </form>

            {/* Sidebar / Drawer */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2>Bibliothèque</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="close-btn">&times;</button>
                </div>
                {savedProjects.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📂</div>
                        <p>Aucun projet sauvegardé.</p>
                    </div>
                ) : (
                    <div className="project-list">
                        {savedProjects.map((proj) => {
                            const date = proj.created_at ? new Date(proj.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "N/A";
                            return (
                                <div key={proj.id} className="project-card">
                                    <div className="card-header">
                                        <h3>{proj.project_name}</h3>
                                        <span className="date-badge" style={{ fontSize: '0.75rem', opacity: 0.8 }}>{date}</span>
                                    </div>
                                    <button onClick={() => { loadProject(proj.id); setIsSidebarOpen(false); }} className="load-btn">
                                        Charger
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {isSidebarOpen && <div className="backdrop" onClick={() => setIsSidebarOpen(false)} />}
        </div>
    );
};

export default ProjectForm;
