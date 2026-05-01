import React, { useEffect, useRef, useState } from "react";
import gantt from "dhtmlx-gantt";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";
import "../App.css";
import { useLocation, useNavigate } from "react-router-dom"; // Import routing hooks
import { publicHolidays } from "../data/holidays";
// sundays import removed as we are using dynamic detection

const GanttChart = () => {
  const ganttContainer = useRef(null);
  const [projectProgress, setProjectProgress] = useState(0);
  const [currentZoom, setCurrentZoom] = useState("day");
  const [showSundayHighlight, setShowSundayHighlight] = useState(false);
  const [showHolidayHighlight, setShowHolidayHighlight] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sundayCount, setSundayCount] = useState(0);
  const [holidayCount, setHolidayCount] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showNewProjectConfirm, setShowNewProjectConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);



  const location = useLocation();
  /* eslint-disable-next-line */
  const navigate = useNavigate();
  const projectData = location.state?.projectData;
  const importedData = location.state?.importedData;

  // State to hold project metadata (allows dynamic updates on import)
  const [metaData, setMetaData] = useState({
    projectName: projectData?.projectName || importedData?.projectName || "Projet Sans Nom",
    description: projectData?.description || importedData?.description || "Aucune description disponible pour ce projet.",
    createdAt: projectData?.createdAt || importedData?.createdAt || new Date().toISOString()
  });

  const [projectDates, setProjectDates] = useState({ start: null, end: null });
  const [taskDetails, setTaskDetails] = useState([]);
  const [showTaskDetails, setShowTaskDetails] = useState(true);

  // Calculate weighted progress
  const calculateProgress = () => {
    let totalWeight = 0;
    let totalProgress = 0;

    gantt.eachTask((task) => {
      if (task.duration > 0) {
        totalWeight += task.duration;
        totalProgress += (task.progress || 0) * task.duration;
      }
    });

    if (totalWeight === 0) return 0;
    return Math.round((totalProgress / totalWeight) * 100);
  };

  // Helper to add working days to a date (Internal helper, though gantt has logic too)
  // eslint-disable-next-line
  const addWorkingDays = (startDate, days) => {
    let count = 0;
    let currentDate = new Date(startDate);

    let safety = 0;
    while (count < days && safety < 1000) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (gantt.isWorkTime(currentDate)) {
        count++;
      }
      safety++;
    }
    return currentDate;
  };

  const updateParentProgress = (taskId) => {
    const task = gantt.getTask(taskId);
    if (!task) return;

    const parentId = task.parent;
    if (parentId && parentId !== 0) {
      const children = gantt.getChildren(parentId);
      let totalDuration = 0;
      let totalWeightedProgress = 0;

      children.forEach((childId) => {
        const child = gantt.getTask(childId);
        // Ensure duration is valid
        const dur = child.duration || 0;
        totalDuration += dur;
        totalWeightedProgress += (child.progress || 0) * dur;
      });

      if (totalDuration > 0) {
        const newProgress = totalWeightedProgress / totalDuration;
        const parent = gantt.getTask(parentId);

        // Only update if changed to avoid unnecessary re-renders/events
        if (Math.abs((parent.progress || 0) - newProgress) > 0.001) {
          parent.progress = newProgress;
          gantt.updateTask(parentId);
          // Bubble up
          updateParentProgress(parentId);
        }
      }
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {

    // If no data, allow render but maybe show warning (handled in logs/UI)
    if (!projectData && !importedData) {
      console.warn("No project data found!");
    }

    gantt.templates.timeline_cell_class = function (item, date) {
      // Dynamic Sunday Check
      if (showSundayHighlight && date.getDay() === 0) {
        return "sunday-highlight";
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      if (showHolidayHighlight && publicHolidays.includes(dateStr)) {
        return "holiday-highlight";
      }
      return "";
    };

    gantt.templates.task_class = function (start, end, task) {
      if (task.progress >= 1) {
        return "completed-task";
      }
      if (task.progress === 0) {
        return "not-started-task";
      }
      return "";
    };

    // Progress Update Listeners
    const updateProgress = (id) => {
      // Update Parent Logic
      if (id && typeof id !== 'object') {
        updateParentProgress(id);
      } else {
        // Initial Load / Full Refresh: Calculate all parents
        gantt.eachTask((task) => {
          // If leaf task (no children)
          if (!gantt.hasChild(task.id) && task.parent) {
            updateParentProgress(task.id);
          }
        });
      }

      const p = calculateProgress();
      setProjectProgress(p);

      // Collect task details for the new section
      const details = [];
      gantt.eachTask((task) => {
        details.push({
          id: task.id,
          text: task.text,
          progress: Math.round((task.progress || 0) * 100),
          parent: task.parent,
          type: task.type
        });
      });
      setTaskDetails(details);
    };

    const e1 = gantt.attachEvent("onAfterTaskUpdate", updateProgress);
    // Note: onAfterTaskAdd usually doesn't need progress update unless default progress > 0
    const e2 = gantt.attachEvent("onAfterTaskAdd", updateProgress);
    const e3 = gantt.attachEvent("onAfterTaskDelete", updateProgress);
    const e4 = gantt.attachEvent("onParse", () => updateProgress()); // Manual trigger for onParse
    const e5 = gantt.attachEvent("onDataRender", () => { }); // Can create loops if we update tasks here

    // Initial render
    gantt.render();
    // setTimeout to allow internal parsing to finish before we recalc weights
    setTimeout(() => updateProgress(), 100);

    return () => {
      gantt.detachEvent(e1);
      gantt.detachEvent(e2);
      gantt.detachEvent(e3);
      gantt.detachEvent(e4);
      gantt.detachEvent(e5);
    };
  }, [showSundayHighlight, showHolidayHighlight, projectData, importedData]);

  useEffect(() => {
    gantt.config.xml_date = "%Y-%m-%d";
    gantt.config.autosize = "y";

    // Enable plugins
    gantt.plugins({
      critical_path: true,
      auto_scheduling: true
    });

    // Configure Auto Scheduling
    gantt.config.auto_scheduling = true;
    gantt.config.auto_scheduling_strict = true;
    gantt.config.work_time = true;
    gantt.config.correct_work_time = true;

    gantt.setWorkTime({ day: 0, hours: false }); // Sunday
    gantt.setWorkTime({ day: 6, hours: true });  // Saturday

    publicHolidays.forEach(date => {
      gantt.setWorkTime({ date: new Date(date), hours: false });
    });

    // Event listener for date updates
    const updateDates = () => {
      let minDate = null;
      let maxDate = null;

      gantt.eachTask((task) => {
        if (!task.start_date || !task.end_date) return;

        if (!minDate || task.start_date < minDate) {
          minDate = task.start_date;
        }
        if (!maxDate || task.end_date > maxDate) {
          maxDate = task.end_date;
        }
      });

      if (minDate && maxDate) {
        // DHTMLX maxDate is exclusive (start of next day). 
        // We subtract 1 day to show the inclusive end date.
        const adjustedMaxDate = new Date(maxDate);
        adjustedMaxDate.setDate(adjustedMaxDate.getDate() - 1);

        setProjectDates({
          start: minDate,
          end: adjustedMaxDate
        });

        // Calculate Sundays and Holidays
        let sCount = 0;
        let hCount = 0;
        let curr = new Date(minDate);
        curr.setHours(0, 0, 0, 0);
        let endD = new Date(adjustedMaxDate);
        endD.setHours(0, 0, 0, 0);

        while (curr <= endD) {
          if (curr.getDay() === 0) sCount++;

          const y = curr.getFullYear();
          const m = String(curr.getMonth() + 1).padStart(2, '0');
          const d = String(curr.getDate()).padStart(2, '0');
          const dStr = `${y}-${m}-${d}`;
          if (publicHolidays.includes(dStr)) hCount++;

          curr.setDate(curr.getDate() + 1);
          curr.setHours(0, 0, 0, 0);
        }
        setSundayCount(sCount);
        setHolidayCount(hCount);

        // Calculate total duration in days (inclusive)
        const durationMs = adjustedMaxDate - minDate;
        const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;
        setTotalDuration(durationDays);
      }
    };


    const dateEvent = gantt.attachEvent("onAfterAutoSchedule", updateDates);
    const renderEvent = gantt.attachEvent("onDataRender", updateDates);

    // Add additional listeners for immediate updates
    const dragEvent = gantt.attachEvent("onAfterTaskDrag", updateDates);
    const addEvent = gantt.attachEvent("onAfterTaskAdd", updateDates);
    const deleteEvent = gantt.attachEvent("onAfterTaskDelete", updateDates);
    const linkAddEvent = gantt.attachEvent("onAfterLinkAdd", updateDates);
    const linkDeleteEvent = gantt.attachEvent("onAfterLinkDelete", updateDates);


    const zoomConfig = {
      levels: [
        {
          name: "day",
          scale_height: 60,
          min_column_width: 80,
          scales: [
            { unit: "day", step: 1, format: "%d %M" }
          ]
        },
        {
          name: "week",
          scale_height: 60,
          min_column_width: 70,
          scales: [
            { unit: "week", step: 1, format: "Semaine #%W" },
            { unit: "day", step: 1, format: "%d %D" }
          ]
        },
        {
          name: "month",
          scale_height: 60,
          min_column_width: 70,
          scales: [
            { unit: "month", step: 1, format: "%F" },
            { unit: "week", step: 1, format: "#%W" }
          ]
        },
        {
          name: "year",
          scale_height: 60,
          min_column_width: 70,
          scales: [
            { unit: "year", step: 1, format: "%Y" },
            { unit: "month", step: 1, format: "%M" }
          ]
        }
      ]
    };

    gantt.ext.zoom.init(zoomConfig);
    gantt.ext.zoom.setLevel("day");

    gantt.i18n.setLocale({
      date: {
        month_full: [
          "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
          "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
        ],
        month_short: [
          "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
          "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"
        ],
        day_full: [
          "Dimanche", "Lundi", "Mardi", "Mercredi",
          "Jeudi", "Vendredi", "Samedi"
        ],
        day_short: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
      },
      labels: {
        new_task: "Nouvelle tâche",
        icon_save: "Enregistrer",
        icon_cancel: "Annuler",
        icon_details: "Détails",
        icon_edit: "Modifier",
        icon_delete: "Supprimer",
        confirm_closing: "Vos modifications seront perdues. Continuer ?",
        confirm_deleting: "La tâche sera supprimée définitivement. Continuer ?",
        section_description: "Description",
        section_time: "Durée",
        section_type: "Type",
        duration_day: "jour",
        duration_days: "jours",
        duration_hour: "heure",
        duration_hours: "heures",
        duration_minute: "minute",
        duration_minutes: "minutes"
      }
    });

    gantt.config.columns = [
      { name: "text", label: "Nom de tâche", tree: true, width: 250, resize: true },
      { name: "start_date", label: "Début", align: "center", width: 100 },
      { name: "duration", label: "Durée", align: "center", width: 80 },
      { name: "add", label: "", width: 44 }
    ];

    gantt.init(ganttContainer.current);

    // Generate tasks if data is available
    if (importedData) {
      gantt.parse(importedData);
      gantt.message({ type: "success", text: "Données importées chargées avec succès" });
    } else if (projectData) {
      const generatedTasks = generateTasks(projectData);
      gantt.parse(generatedTasks);
    } else {
      gantt.message({ type: "warning", text: "Aucune donnée de projet trouvée." });
    }

    const handleWheel = (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        gantt.ext.zoom.zoomIn();
      } else {
        gantt.ext.zoom.zoomOut();
      }
    };

    const container = ganttContainer.current;
    container.addEventListener("wheel", handleWheel, { passive: false });

    const handleZoomStateChange = (level, config) => {
      if (config && config.name) {
        setCurrentZoom(config.name);
      } else {
        setCurrentZoom(level);
      }
    };

    gantt.ext.zoom.attachEvent("onAfterZoom", handleZoomStateChange);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      gantt.clearAll();
      gantt.detachEvent(dateEvent);
      gantt.detachEvent(renderEvent);
      gantt.detachEvent(dragEvent);
      gantt.detachEvent(addEvent);
      gantt.detachEvent(deleteEvent);
      gantt.detachEvent(linkAddEvent);
      gantt.detachEvent(linkDeleteEvent);
    };
  }, [projectData]);

  // Fetch saved projects on mount
  // Fetch saved projects on mount effect removed to strictly follow user requirement:
  // "le code pour le listage des fichiers sauvegardés ne s'éxecute que à chaque fois que l'on appuie sur le bouton"

  // Function to calculate duration
  // ---------------------------
  // Central duration util
  // ---------------------------
  // calculateDuration: retourne le nombre de jours actifs (entier >= 1)
  // baseCalc: durée métier de référence (jours actifs)
  // complexity: coefficient C
  // crewFactor: coefficient K
  // modifiers: { soilFactor, finishFactor, weatherFactor }
  // rounding: "ceil" (par défaut) ou "round"
  const calculateDuration = (baseCalc, complexity, crewFactor, modifiers = {}, rounding = "ceil", minDuration = 1) => {
    const { soilFactor = 1, finishFactor = 1, weatherFactor = 1 } = modifiers;

    // Défensive: baseCalc peut être 0 ou NaN
    const base = Number.isFinite(parseFloat(baseCalc)) ? parseFloat(baseCalc) : 0;

    const raw = base * (complexity / crewFactor) * soilFactor * finishFactor * weatherFactor;

    let days;
    if (rounding === "round") {
      days = Math.max(minDuration, Math.round(raw));
    } else {
      // ceil est conservateur et recommandé pour estimations chantier
      days = Math.max(minDuration, Math.ceil(raw));
    }

    return days;
  };

  // ---------------------------
  // generateTasks (utilise calculateDuration partout)
  // ---------------------------
  const generateTasks = (data) => {
    // Destructure using NEW variable names
    const {
      SH, P, E,
      SE, SJ,
      SP_bassin, SP_plage,
      SD, ST,
      UT,
      C, K,
      soilFactor, finishFactor, weatherFactor,
      startDate,
      // optional drying days (calendar/working-days)
      foundationsDryingDays, chapeDryingDays, dallageDryingDays
    } = data;

    // Parse all inputs to floats (fallback to sensible defaults)
    const SurfHab = parseFloat(SH) || 0;
    const Rooms = parseFloat(P) || 0;
    const Floors = parseFloat(E) || 0;
    const SurfExt = parseFloat(SE) || 0;
    const SurfJard = parseFloat(SJ) || 0;
    const PoolBas = parseFloat(SP_bassin) || 0;
    const PoolPlage = parseFloat(SP_plage) || 0;
    const SurfDep = parseFloat(SD) || 0;
    const SurfToit = parseFloat(ST) || 0;
    const Utils = parseFloat(UT) || 0;

    const Comp = parseFloat(C) || 1.0;
    const Crew = parseFloat(K) || 1.0;
    const Soil = parseFloat(soilFactor) || 1.0;
    const Finish = parseFloat(finishFactor) || 1.0;
    const Weather = parseFloat(weatherFactor) || 1.0;

    // Drying days default (calendar/working days as configured in gantt)
    const foundationsDry = Number.isFinite(parseFloat(foundationsDryingDays)) ? parseInt(foundationsDryingDays, 10) : 7;
    const chapeDry = Number.isFinite(parseFloat(chapeDryingDays)) ? parseInt(chapeDryingDays, 10) : 7;
    const dallageDry = Number.isFinite(parseFloat(dallageDryingDays)) ? parseInt(dallageDryingDays, 10) : 3;

    let currentStart = new Date(startDate);
    const tasksList = [];
    const linksList = [];
    let taskId = 1;

    // Helper to format date to yyyy-mm-dd
    const createDateStr = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // addTask: name, baseDuration (jours actifs), parentId, color, customStartDate (Date obj),
    // ignoreForGlobalStart (if true don't move global pointer), extraFactor (multiplier on base), dryingDays (calendar working days)
    // RETURNS { id, endDate, endDateAfterDry }
    const addTask = (name, baseDuration, parentId = null, color = null, customStartDate = null, ignoreForGlobalStart = false, extraFactor = 1.0, dryingDays = 0) => {
      const MIN_DURATIONS = {
        "Implantation et terrassement": 2,
        "Fondations": 7,
        "Assainissement / VRD": 3,
        "Soubassement": 3,
        "Dallage": 2,
        "Élévation des murs": 6,
        "Charpente": 5,
        "Couverture / Zinguerie": 5,
        "Menuiseries extérieures": 3,
        "Isolation / Plâtrerie": 6,
        "Electricité (incorporation)": 4,
        "Plomberie (incorporation)": 4,
        "Chape": 2,
        "Revêtements de sols": 4,
        "Menuiseries intérieures": 3,
        "Peinture / Décoration": 6,
        "Equipements (Cuisine, Sanitaires)": 2,
        "Nettoyage et Réception": 1,
        "Piscine (structure + plage)": 12,
        "Terrasse extérieure": 3,
        "Jardin paysagé": 3,
        "Dépendance / Garage": 5,
        "Domotique": 2,
        "Panneaux solaires": 2
      };

      const appliedBase = baseDuration * extraFactor;
      const minDur = MIN_DURATIONS[name] || 1;
      const duration = calculateDuration(appliedBase, Comp, Crew, { soilFactor: Soil, finishFactor: Finish, weatherFactor: Weather }, "ceil", minDur);
      const startToUse = customStartDate ? new Date(customStartDate) : new Date(currentStart);

      const task = {
        id: taskId,
        text: name,
        start_date: createDateStr(startToUse),
        duration,
        progress: 0.0,
        parent: parentId,
        color,
        open: true
      };

      tasksList.push(task);
      const myId = taskId++;

      // Compute end date using gantt (respects working days config)
      const endDate = gantt.calculateEndDate({ start_date: startToUse, duration: duration, task: task });

      // If dryingDays > 0, compute endDateAfterDry using gantt (skips non-working days)
      let endDateAfterDry = endDate;
      if (dryingDays && dryingDays > 0) {
        endDateAfterDry = gantt.calculateEndDate({ start_date: endDate, duration: dryingDays, task: task });
      }

      // Update global pointer ONLY if not ignored
      if (!ignoreForGlobalStart) {
        currentStart = endDateAfterDry;
      }

      // Return id and both end dates for flexibility
      return { id: myId, endDate, endDateAfterDry };
    };

    // --- 1. PHASE PARENTS ---
    const phase1Id = taskId++;
    tasksList.push({ id: phase1Id, text: "Gros Œuvre", start_date: createDateStr(currentStart), type: "project", open: true, color: "#3498db" });

    const phase2Id = taskId++;
    tasksList.push({ id: phase2Id, text: "Second Œuvre", start_date: createDateStr(currentStart), type: "project", open: true, color: "#e67e22" });

    const phase3Id = taskId++;
    tasksList.push({ id: phase3Id, text: "Finitions", start_date: createDateStr(currentStart), type: "project", open: true, color: "#2ecc71" });

    const phase4Id = taskId++;
    tasksList.push({ id: phase4Id, text: "Extérieurs & Piscine", start_date: createDateStr(currentStart), type: "project", open: true, color: "#9b59b6" });

    // 1. Implantation et terrassement
    // base = SH / 50 (m² / jour), soil affects excavation difficulty
    const t1 = addTask("Implantation et terrassement", SurfHab / 50, phase1Id, "#3498db", null, false, 1.0, 2);


    const t2 = addTask("Fondations", SurfHab / 10, phase1Id, "#3498db", null, false, 1.0, foundationsDry);
    linksList.push({ id: linksList.length + 1, source: t1.id, target: t2.id, type: "0" });


    // base = (SH / 100) + Floors * 1.5
    const t3 = addTask("Assainissement / VRD", (SurfHab / 100) + (Floors * 1.5), phase1Id, "#3498db", null, false, 1.0, 0);
    linksList.push({ id: linksList.length + 1, source: t2.id, target: t3.id, type: "0" });

    const t4 = addTask("Soubassement", SurfHab / 20, phase1Id, "#3498db", null, false, 1.0, 0);
    linksList.push({ id: linksList.length + 1, source: t3.id, target: t4.id, type: "0" });

    const t5 = addTask("Dallage", SurfHab / 40, phase1Id, "#3498db", null, false, 1.0, dallageDry);
    linksList.push({ id: linksList.length + 1, source: t4.id, target: t5.id, type: "0" });

    const t6 = addTask("Élévation des murs", (SurfHab * Math.max(1, Floors)) / 12, phase1Id, "#3498db", null, false, Weather, 0);
    linksList.push({ id: linksList.length + 1, source: t5.id, target: t6.id, type: "0" });

    const t7 = addTask("Charpente", 5 + (2 * Floors), phase1Id, "#3498db", null, false, Weather, 0);
    linksList.push({ id: linksList.length + 1, source: t6.id, target: t7.id, type: "0" });

    const roofBase = SurfToit > 0 ? (SurfToit / 30) : (SurfHab / 15);
    const t8 = addTask("Couverture / Zinguerie", roofBase, phase1Id, "#3498db", null, false, Weather, 0);
    linksList.push({ id: linksList.length + 1, source: t7.id, target: t8.id, type: "0" });

    const t9 = addTask("Menuiseries extérieures", Rooms / 2, phase2Id, "#e67e22");
    linksList.push({ id: linksList.length + 1, source: t8.id, target: t9.id, type: "0" });

    const t10 = addTask("Isolation / Plâtrerie", (SurfHab * Math.max(1, Floors)) / 8, phase2Id, "#e67e22");
    linksList.push({ id: linksList.length + 1, source: t9.id, target: t10.id, type: "0" });

    const elecBaseDuration = (Rooms * 0.8) + (SurfHab / 100) + (Utils * 0.5);
    const t11 = addTask("Electricité (incorporation)", elecBaseDuration, phase2Id, "#e67e22");
    linksList.push({ id: linksList.length + 1, source: t10.id, target: t11.id, type: "0" });

    // Plomberie: base = (P * 0.6) + Floors
    // Start at the same earliest time as t10 end; pass t10.endDate as customStartDate and ignore for global pointer
    const t12 = addTask("Plomberie (incorporation)", (Rooms * 0.6) + Floors, phase2Id, "#e67e22", t10.endDate, true);
    linksList.push({ id: linksList.length + 1, source: t10.id, target: t12.id, type: "0" });

    // Wait for both Elec and Plomb to finish -> Chape
    // Use later of t11.endDateAfterDry and t12.endDateAfterDry if available
    const elecEnd = t11.endDateAfterDry || t11.endDate;
    const plombEnd = t12.endDateAfterDry || t12.endDate;
    const laterOfElecPlumb = (plombEnd && plombEnd > elecEnd) ? plombEnd : elecEnd;
    if (laterOfElecPlumb && laterOfElecPlumb > currentStart) {
      currentStart = laterOfElecPlumb;
    }

    // 13. Chape (SH / 20) + drying days
    const t13 = addTask("Chape", SurfHab / 20, phase2Id, "#e67e22", null, false, 1.0, chapeDry);
    linksList.push({ id: linksList.length + 1, source: t11.id, target: t13.id, type: "0" });
    linksList.push({ id: linksList.length + 1, source: t12.id, target: t13.id, type: "0" });

    // --- Phase 3: Finitions ---
    const t14 = addTask("Revêtements de sols", SurfHab / 12, phase3Id, "#2ecc71", null, false, Finish);
    linksList.push({ id: linksList.length + 1, source: t13.id, target: t14.id, type: "0" });

    const t15 = addTask("Menuiseries intérieures", Rooms / 2, phase3Id, "#2ecc71");
    linksList.push({ id: linksList.length + 1, source: t14.id, target: t15.id, type: "0" });

    const t16 = addTask("Peinture / Décoration", (SurfHab * Math.max(1, Floors)) / 10, phase3Id, "#2ecc71", null, false, Finish);
    linksList.push({ id: linksList.length + 1, source: t15.id, target: t16.id, type: "0" });

    const t17 = addTask("Equipements (Cuisine, Sanitaires)", 2 + (Rooms / 5), phase3Id, "#2ecc71");
    linksList.push({ id: linksList.length + 1, source: t16.id, target: t17.id, type: "0" });

    const t18 = addTask("Nettoyage et Réception", (SurfHab / 80) + 1, phase3Id, "#2ecc71");
    linksList.push({ id: linksList.length + 1, source: t17.id, target: t18.id, type: "0" });

    // --- 4. PARALLEL OPTIONS (PHASE 4) ---
    // Piscine: professional base = 12 days active + plage by m² (SP_plage / 15)
    if (PoolBas > 0) {
      const poolBase = 12 + (PoolPlage / 15);
      // We start pool after implantation (t1), but keep it parallel (ignoreForGlobalStart true)
      const t19 = addTask("Piscine (structure + plage)", poolBase, phase4Id, "#9b59b6", t1.endDate, true, Soil, 0);
      linksList.push({ id: linksList.length + 1, source: t1.id, target: t19.id, type: "0" });
    }

    // Terrasse extérieure: use SurfExt / 15 (15 m²/day / équipe)
    if (SurfExt > 0) {
      const terraceBase = SurfExt / 15;
      const t20 = addTask("Terrasse extérieure", terraceBase, phase4Id, "#9b59b6", t5.endDate, true, Soil, 0);
      linksList.push({ id: linksList.length + 1, source: t5.id, target: t20.id, type: "0" });
    }

    // Jardin paysagé: SJ / 50
    if (SurfJard > 0) {
      const gardenBase = SurfJard / 50;
      const t21 = addTask("Jardin paysagé", gardenBase, phase4Id, "#9b59b6", t3.endDate, true, Soil, 0);
      linksList.push({ id: linksList.length + 1, source: t3.id, target: t21.id, type: "0" });
    }

    // Dépendance / Garage: proportional to surface (SD / 12)
    if (SurfDep > 0) {
      const garageBase = SurfDep / 12;
      const t22 = addTask("Dépendance / Garage", garageBase, phase4Id, "#9b59b6", t2.endDate, true, Soil, 0);
      linksList.push({ id: linksList.length + 1, source: t2.id, target: t22.id, type: "0" });
    }

    // Domotique: 2 days + UT*0.2; depends on electricity (t11)
    if (Utils > 0) {
      const domoBase = 2 + (Utils * 0.2);
      const t23 = addTask("Domotique", domoBase, phase4Id, "#9b59b6", t11.endDate, true, Finish, 0);
      linksList.push({ id: linksList.length + 1, source: t11.id, target: t23.id, type: "0" });
    }

    // Panneaux solaires: 2 days base + ST/100
    if (SurfToit > 0) {
      const solarBase = 2 + (SurfToit / 100);
      const t24 = addTask("Panneaux solaires", solarBase, phase4Id, "#9b59b6", t8.endDate, true, 1.0, 0);
      linksList.push({ id: linksList.length + 1, source: t8.id, target: t24.id, type: "0" });
    }

    return { data: tasksList, links: linksList };
  };

  const drawTodayLine = () => {
    const today = new Date();
    const todayPos = gantt.posFromDate(today);

    const marker = document.createElement("div");
    marker.className = "today-line";
    marker.style.left = todayPos + "px";

    const area = gantt.$task_data;
    if (area) {
      const old = area.querySelector(".today-line");
      if (old) old.remove();
      area.appendChild(marker);
    }
  };

  const centerToday = () => {
    const today = new Date();
    gantt.ext.zoom.setLevel("day");
    setCurrentZoom("day");
    gantt.showDate(today);
    drawTodayLine();
    setTimeout(() => {
      const todayStr = gantt.date.date_to_str("%d-%m-%Y")(today);
      const taskCells = document.querySelectorAll(".gantt_task .gantt_task_cell");
      taskCells.forEach((cell) => {
        const cellDate = cell.getAttribute("data-date");
        if (cellDate) {
          const cellStr = gantt.date.date_to_str("%d-%m-%Y")(new Date(cellDate));
          if (cellStr === todayStr) {
            cell.classList.add("today-column-blink");
          }
        }
      });
      setTimeout(() => {
        document.querySelectorAll(".today-column-blink").forEach((el) => {
          el.classList.remove("today-column-blink");
        });
      }, 2500);
    }, 300);
  };

  const handleZoomChange = (value) => {
    if (gantt.ext.zoom) {
      gantt.ext.zoom.setLevel(value);
      setCurrentZoom(value);
    }
  }

  const zoomLevels = [
    { label: "Jours", value: "day" },
    { label: "Semaines", value: "week" },
    { label: "Mois", value: "month" },
    { label: "Années", value: "year" },
  ];

  const exportPDF = async () => {
    const ganttElement = ganttContainer.current;

    // Capture current view
    // gantt.scrollTo(0, 0); // REMOVED: User wants to keep the current view position


    const canvas = await html2canvas(ganttElement, { scale: 2, useCORS: true });

    // Restore scroll (if needed, though we might not need to strictly)

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("landscape", "pt", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Calculate ratio to fit width
    const ratio = imgWidth / pageWidth;
    const finalHeight = imgHeight / ratio;

    const descripPDF = metaData.description ? metaData.description : 'Aucune description';

    // --- Dynamic Header Calculation ---
    // We pre-calculate the height needed for the header to avoid overlaps
    pdf.setFontSize(11); // Set font size used for description to calculate lines
    const availableWidth = pageWidth - 80; // 40px margin on each side
    const descLines = pdf.splitTextToSize(descripPDF, availableWidth);

    // Layout Metrics
    const titleY = 40;
    const titleHeight = 25;
    const descLineHeight = 14;
    const descBlockHeight = descLines.length * descLineHeight;
    const spacer = 20;
    const statsHeight = 30; // Date and progress line

    const contentHeight = titleY + titleHeight + descBlockHeight + spacer + statsHeight;
    const headerHeight = contentHeight + 20; // Add some bottom padding
    // ----------------------------------

    const effectivePageHeight = pageHeight - headerHeight;

    let position = 0;

    while (position < finalHeight) {
      // Add Header on the first page
      if (position === 0) {
        // 1. Title
        pdf.setFontSize(18);
        pdf.setTextColor(40);
        pdf.setFont(undefined, 'bold');
        pdf.text(metaData.projectName, 40, titleY);

        // 2. Description
        pdf.setFontSize(11);
        pdf.setTextColor(80);
        pdf.setFont(undefined, 'normal');
        pdf.text(descLines, 40, titleY + titleHeight);

        // 3. Separator Line
        const lineY = titleY + titleHeight + descBlockHeight + 10;
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.5);
        pdf.line(40, lineY, pageWidth - 40, lineY);

        // 4. Dates & Progress
        const statsY = lineY + 20;
        const startStr = projectDates.start ? projectDates.start.toLocaleDateString('fr-FR') : 'N/A';
        const endStr = projectDates.end ? projectDates.end.toLocaleDateString('fr-FR') : 'N/A';

        pdf.setFontSize(10);
        pdf.setTextColor(60);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Période : ${startStr} - ${endStr}`, 40, statsY);

        const progressText = `Progression : ${projectProgress}%`;
        const pWidth = pdf.getTextWidth(progressText);
        pdf.setTextColor(projectProgress === 100 ? 22 : 60, projectProgress === 100 ? 163 : 60, projectProgress === 100 ? 74 : 60); // Green if 100%
        pdf.text(progressText, pageWidth - 40 - pWidth, statsY);
      }

      // Place image with offset
      // y = headerHeight - position
      pdf.addImage(imgData, "PNG", 0, headerHeight - position, pageWidth, finalHeight);

      position += effectivePageHeight;

      if (position < finalHeight) {
        pdf.addPage();
      }
    }

    const filename = `${metaData.projectName.replace(/\s+/g, "_")}.pdf`;
    pdf.save(filename);
  };

  // Circular Chart Constants
  const radius = 36;
  const stroke = 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (projectProgress / 100) * circumference;

  /* ------------------------------------------- */
  /*  MS PROJECT EXPORT (Excel)                  */
  /* ------------------------------------------- */
  const handleExportExcel = async () => {
    try {
      const tasks = [];
      const links = gantt.getLinks();

      // Helper to format date for backend
      const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        // Include time if needed, but usually Date is enough for MSP start/end
        // We stick to YYYY-MM-DD HH:mm:ss to be safe or just YYYY-MM-DD
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}:${s}`;
      };

      // WBS Calculation Logic
      // We assume eachTask iterates in display order (DFS).
      // We keep a stack of counters for WBS generation.
      let wbsCounters = [];

      gantt.eachTask((task) => {
        const level = task.$level || 0; // 0-based

        // Adjust counters
        // If we go deeper (e.g. level 0 -> 1), we extend counters
        // If we stay same level, we increment last
        // If we go up, we slice

        if (level >= wbsCounters.length) {
          // Deeper
          wbsCounters.push(1);
        } else {
          // Same or up
          // Reset everything deeper than current level
          wbsCounters = wbsCounters.slice(0, level + 1);
          wbsCounters[level]++;
        }

        const wbs = wbsCounters.join(".");

        tasks.push({
          id: task.id,
          text: task.text,
          start_date: formatDate(task.start_date),
          end_date: formatDate(task.end_date),
          duration: task.duration,
          progress: task.progress,
          parent: task.parent,
          wbs: wbs,
          outline_level: level + 1, // 1-based for MSP
          type: task.type,
          open: task.open,
          color: task.color
        });
      });

      const payload = {
        tasks,
        links: links.map(l => ({
          id: l.id,
          source: l.source,
          target: l.target,
          type: l.type,
          lag: l.lag || 0
        }))
      };

      const response = await fetch("http://localhost:8000/export/excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Erreur export backend");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeProjectName = metaData.projectName ? metaData.projectName.replace(/\s+/g, "_") : "Projet";
      a.download = `${safeProjectName}_Planning_MSProject.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      gantt.message({ type: "success", text: "Export Excel (MS Project) terminé !" });

    } catch (error) {
      console.error("Erreur Export Excel:", error);
      gantt.message({ type: "error", text: "Erreur lors de l'export Excel" });
    }
  };


  const exportJSON = () => {
    const data = gantt.serialize();

    // Mettre les metadata dans l'export
    const finalExport = {
      ...data,
      projectName: metaData.projectName,
      description: metaData.description,
      createdAt: metaData.createdAt
    };

    // // ---- ENVOI À FASTAPI ----
    // fetch("http://localhost:8000/save-json", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     project_name: metaData.projectName,
    //     json_data: finalExport
    //   })
    // })
    //   .then(res => res.json())
    //   .then(data => console.log("JSON sauvegardé en base:", data))
    //   .catch(err => console.error("Erreur sauvegarde:", err));

    // ---- EXPORT FICHIER JSON----
    const jsonString = JSON.stringify(finalExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${metaData.projectName.replace(/\s+/g, '_')}_data.json`; // Dynamic filename
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const save = () => {
    const data = gantt.serialize();

    // Mettre les metadata dans l'export
    const finalExport = {
      ...data,
      projectName: metaData.projectName,
      description: metaData.description,
      createdAt: metaData.createdAt
    };

    // ---- ENVOI À FASTAPI ----
    fetch("http://localhost:8000/save-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: metaData.projectName,
        json_data: finalExport
      })
    })
      .then(res => res.json())
      .then(data => {
        console.log("JSON sauvegardé en base:", data);
        gantt.message({ type: "success", text: "Projet sauvegardé avec succès" });
      })
      .catch(err => {
        console.error("Erreur sauvegarde:", err);
        gantt.message({ type: "error", text: "Échec de la sauvegarde" });
      });
  };

  const [savedProjects, setSavedProjects] = useState([]);

  const fetchSavedProjects = async () => {
    const res = await fetch("http://localhost:8000/gantt/list");
    const data = await res.json();
    console.log("Projets sauvegardés :", data);

    setSavedProjects(data);
  };

  const loadProject = async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/gantt/${id}`);
      const record = await res.json();

      if (record.error) {
        alert("Projet introuvable !");
        return;
      }

      // Le JSON complet est stocké dans json_data
      const fullProjectData = record.json_data;

      // Reset
      gantt.clearAll();

      // Parse data
      if (fullProjectData.data || fullProjectData.tasks) { // Handle different potential structures
        gantt.parse(fullProjectData.data ? fullProjectData : { data: fullProjectData.tasks, links: fullProjectData.links });
      } else {
        gantt.parse(fullProjectData);
      }

      // Update Metadata
      const loadedMeta = {
        projectName: record.project_name || fullProjectData.projectName || "Projet Chargé",
        description: fullProjectData.description || "Description non disponible",
        createdAt: fullProjectData.createdAt || new Date().toISOString()
      };
      setMetaData(loadedMeta);

      gantt.message({ type: "success", text: `Projet "${record.project_name}" chargé` });

    } catch (err) {
      console.error("Erreur de chargement:", err);
      gantt.message({ type: "error", text: "Impossible de charger le projet" });
    }
  };



  const fileInputRef = useRef(null);

  const triggerImport = () => {
    fileInputRef.current.click();
  };

  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.data && Array.isArray(json.data)) {
          gantt.clearAll();
          gantt.parse(json);

          // Update metadata state safely
          setMetaData({
            projectName: json.projectName || "Projet Importé",
            description: json.description || "Description importée depuis le fichier JSON.",
            createdAt: json.createdAt || new Date().toISOString()
          });

          gantt.message({ type: "success", text: "Importation réussie" });
        } else {
          gantt.message({ type: "error", text: "Fichier JSON non valide" });
        }
      } catch (error) {
        console.error("Erreur lors de l'importation JSON:", error);
        gantt.message({ type: "error", text: "Erreur de lecture du fichier" });
      }
    };

    reader.readAsText(file);
    // Reset value to allow re-importing same file
    event.target.value = "";
  };
  const handleNewProject = () => {
    setShowNewProjectConfirm(true);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Logout Button positioned above the controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', paddingRight: '24px', paddingTop: '16px' }}>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            background: 'white',
            color: '#ef4444',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fef2f2';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.1)';
          }}
        >
          Déconnexion
        </button>
      </div>


      <div className="gantt-controls-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>

        {/* SECTION 1: HEADER (Project Info & Status) */}
        {metaData && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '20px'
          }}>
            <div style={{ maxWidth: '60%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', letterSpacing: '-0.025em' }}>
                  {metaData.projectName}
                </h1>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '20px' }}>
                  Créé le {new Date(metaData.createdAt).toLocaleDateString('fr-FR')} à {new Date(metaData.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p style={{ margin: 0, color: '#64748b', fontSize: '1rem', lineHeight: '1.6' }}>
                {metaData.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
              {/* Dates */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>Début</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a' }}>
                    {projectDates.start ? projectDates.start.toLocaleDateString('fr-FR') : '-'}
                  </span>
                </div>
                <div style={{ width: '1px', backgroundColor: '#e2e8f0' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>Fin</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a' }}>
                    {projectDates.end ? projectDates.end.toLocaleDateString('fr-FR') : '-'}
                  </span>
                </div>

                <div style={{ width: '1px', backgroundColor: '#e2e8f0' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>Durée Totale</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a' }}>
                    {totalDuration} jours
                  </span>
                </div>

                <div style={{ width: '1px', backgroundColor: '#e2e8f0' }}></div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>Dimanches</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                      {sundayCount}
                    </span>
                  </div>
                  <div style={{ width: '1px', backgroundColor: '#f1f5f9' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>Fériés</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                      {holidayCount}
                    </span>
                  </div>
                </div>
              </div>



              {/* Progress Circle (Compact) */}
              <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg
                  height="60"
                  width="60"
                  style={{ transform: 'rotate(-90deg)' }}
                >
                  <circle
                    stroke="#e2e8f0"
                    strokeWidth="4"
                    fill="transparent"
                    r="26"
                    cx="30"
                    cy="30"
                  />
                  <circle
                    stroke={projectProgress === 100 ? "#10b981" : "#4f46e5"}
                    strokeWidth="4"
                    strokeDasharray={26 * 2 * Math.PI + ' ' + 26 * 2 * Math.PI}
                    style={{
                      strokeDashoffset: (26 * 2 * Math.PI) - (projectProgress / 100) * (26 * 2 * Math.PI),
                      transition: 'stroke-dashoffset 0.5s ease-in-out'
                    }}
                    strokeLinecap="round"
                    fill="transparent"
                    r="26"
                    cx="30"
                    cy="30"
                  />
                </svg>
                <span style={{ position: 'absolute', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                  {projectProgress}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: TOOLBAR (Actions) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>

          {/* Left: View Controls */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Zoom Group */}
            <div className="group-buttons" style={{ boxShadow: 'none', border: '1px solid #e2e8f0', backgroundColor: 'transparent' }}>
              {zoomLevels.map(({ label, value }) => (
                <button
                  key={value}
                  className={`control-btn ${currentZoom === value ? "active" : ""}`}
                  onClick={() => handleZoomChange(value)}
                  style={{ padding: '8px 16px', fontSize: '0.9rem', border: 'none', boxShadow: 'none', background: currentZoom === value ? '#eff6ff' : 'transparent', color: currentZoom === value ? '#2563eb' : '#64748b' }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="control-btn"
                onClick={centerToday}
                title="Centrer sur aujourd'hui"
                style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}
              >
                <img src="/today.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                Aujourd'hui
              </button>

              <label className="toggle-label" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={showSundayHighlight}
                  onChange={(e) => setShowSundayHighlight(e.target.checked)}
                />
                <span className="custom-checkbox"></span>
                <span style={{ marginLeft: '8px' }}>Dimanches</span>
              </label>
              <label className="toggle-label" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={showHolidayHighlight}
                  onChange={(e) => setShowHolidayHighlight(e.target.checked)}
                />
                <span className="custom-checkbox"></span>
                <span style={{ marginLeft: '8px' }}>Jours fériés</span>
              </label>
            </div>
          </div>

          {/* Right: Project Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Import/Export Group */}
            <div className="group-buttons" style={{ padding: '4px', gap: '4px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <button
                className="control-btn"
                onClick={exportPDF}
                title="Exporter en PDF"
                style={{ border: 'none', background: 'transparent', padding: '8px', color: '#64748b' }}
              >
                <img src="/pdf.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                PDF
              </button>
              <button
                className="control-btn"
                onClick={exportJSON}
                title="Exporter en JSON"
                style={{ border: 'none', background: 'transparent', padding: '8px', color: '#64748b' }}
              >
                <img src="/gantt_export_100px.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                JSON
              </button>
              <button
                className="control-btn"
                onClick={handleExportExcel}
                title="Exporter pour MS Project"
                style={{ border: 'none', background: 'transparent', padding: '8px', color: '#64748b' }}
              >
                <img src="/excel_export.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                Excel
              </button>
            </div>

            <button
              className="control-btn"
              onClick={triggerImport}
              style={{ borderColor: '#e2e8f0', color: '#334155' }}
            >
              <img src="/gantt_import_100.png" alt="" style={{ width: '24px', height: '30px', objectFit: 'contain' }} />
              Importer
            </button>

            <button
              className="control-btn"
              onClick={() => {
                setIsSidebarOpen(true);
                fetchSavedProjects();
              }}
              style={{ borderColor: '#6366f1', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <img src="/mes_projets.png" alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
              Mes Projets
            </button>

            <button
              className="control-btn"
              onClick={save}
              style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#059669' }}
            >
              ✓ Sauvegarder
            </button>

            <button
              className="control-btn"
              onClick={handleNewProject}
              style={{ backgroundColor: '#4f46e5', color: 'white', borderColor: '#4338ca' }}
            >
              + Nouveau
            </button>
          </div>

        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept=".json"
          onChange={handleImportJSON}
        />

        {/* Sidebar / Drawer for Saved Projects */}
        <div style={{
          position: 'fixed',
          top: 0,
          right: isSidebarOpen ? 0 : '-500px',
          width: '400px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
          transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1000,
          padding: '32px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0, color: '#0f172a' }}>Bibliothèque</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.5rem', color: '#94a3b8', padding: '8px', borderRadius: '8px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              &times;
            </button>
          </div>

          {savedProjects.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '60px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>📂</div>
              <p>Aucun projet sauvegardé pour le moment.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {savedProjects.map((proj) => {
                const date = proj.created_at ? new Date(proj.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Date inconnue";

                return (
                  <div key={proj.id} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.02)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>{proj.project_name}</h3>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', backgroundColor: '#f8fafc', padding: '4px 8px', borderRadius: '4px' }}>{date}</span>
                    </div>

                    <button
                      onClick={() => {
                        loadProject(proj.id);
                        setIsSidebarOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#f1f5f9',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#475569',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#4f46e5';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.color = '#475569';
                      }}
                    >
                      Charger le projet
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Backdrop */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 999,
              transition: 'opacity 0.3s'
            }}
          />
        )}


        <div
          ref={ganttContainer}
          className="gantt-container"
          style={{ width: "100%" }}
        ></div>

        {/* SECTION 3: TASK DETAILS (NEW) */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          marginTop: '24px'
        }}>
          <div
            onClick={() => setShowTaskDetails(!showTaskDetails)}
            style={{
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              background: '#ffffff',
              borderBottom: showTaskDetails ? '1px solid #e2e8f0' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/stats.png" alt="" style={{ width: '30px', height: '35px', objectFit: 'contain' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#334155' }}>Détails de l'Avancement du Projet</h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                {taskDetails.length} tâches
              </span>
            </div>
            <span style={{
              transform: showTaskDetails ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
              color: '#64748b',
              fontWeight: 'bold'
            }}>
              ▼
            </span>
          </div>

          {showTaskDetails && (
            <div
              className="hide-scrollbar"
              style={{
                padding: '20px',
                paddingBottom: '40px',
                maxHeight: '400px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px',
                backgroundColor: 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(8px)'
              }}
            >
              {taskDetails.map((task) => (
                <div
                  key={task.id}
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'transform 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#1e293b',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '1.4'
                    }}>
                      {task.text}
                    </span>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: task.progress === 100 ? '#10b981' : '#4f46e5',
                      backgroundColor: task.progress === 100 ? '#ecfdf5' : '#eef2ff',
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}>
                      {task.progress}%
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${task.progress}%`,
                      height: '100%',
                      backgroundColor: task.progress === 100 ? '#10b981' : '#4f46e5',
                      borderRadius: '4px',
                      transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back to Top Button */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              position: 'fixed',
              bottom: '40px',
              right: '40px',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontSize: '20px',
              color: '#4f46e5'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
            }}
          >
            ↑
          </button>
        )}

        {showNewProjectConfirm && (
          <div className="modal-overlay" onClick={() => setShowNewProjectConfirm(false)} style={{ zIndex: 10000 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', border: 'none', borderRadius: '24px', position: 'relative', overflow: 'visible' }}>
              {/* Elegant accent bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'linear-gradient(90deg, #4f46e5, #818cf8)', borderRadius: '24px 24px 0 0' }}></div>

              <div style={{ padding: '40px 32px' }}>
                <div style={{
                  width: '80px', height: '80px', backgroundColor: '#fef2f2', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                  fontSize: '40px', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.1)'
                }}>
                  <span role="img" aria-label="warning">⚠️</span>
                </div>

                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '12px', textAlign: 'center', letterSpacing: '-0.02em' }}>
                  Nouveau Projet ?
                </h2>

                <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px', textAlign: 'center' }}>
                  Les données non sauvegardées seront <strong style={{ color: '#ef4444' }}>perdues</strong>. Souhaitez-vous vraiment continuer ?
                </p>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    onClick={() => setShowNewProjectConfirm(false)}
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
                    onClick={() => {
                      setShowNewProjectConfirm(false);
                      gantt.clearAll();
                      navigate("/form");
                    }}
                    style={{
                      flex: 1, padding: '16px', borderRadius: '16px', border: 'none',
                      backgroundColor: '#4f46e5', color: 'white', fontWeight: '700', cursor: 'pointer',
                      boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)', transition: 'all 0.2s',
                      fontSize: '1rem'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 20px -5px rgba(79, 70, 229, 0.4)'; e.currentTarget.style.backgroundColor = '#4338ca'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(79, 70, 229, 0.3)'; e.currentTarget.style.backgroundColor = '#4f46e5'; }}
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showLogoutConfirm && (
          <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)} style={{ zIndex: 10001 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', border: 'none', borderRadius: '24px', position: 'relative', overflow: 'visible' }}>
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

                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '12px', textAlign: 'center', letterSpacing: '-0.02em' }}>
                  Se déconnecter ?
                </h2>

                <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px', textAlign: 'center' }}>
                  Êtes-vous sûr de vouloir quitter ? Les modifications non sauvegardées seront <strong style={{ color: '#ef4444' }}>définitivement perdues</strong>.
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
                      navigate("/", { replace: true });
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
    </div>
  );
};



export default GanttChart;
