import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import GanttChart from "./components/GanttChart";
import ProjectForm from "./components/ProjectForm";
import Login from "./components/Login";
import Register from "./components/Register";
import AdminPanel from "./components/AdminPanel";
import TeamDashboard from "./components/TeamDashboard";
import "./App.css";

// Helper component for protected routes
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Helper component for admin-only routes
const AdminRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const role = localStorage.getItem("userRole");

  if (!isAuthenticated || role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Helper component for team-only routes
const TeamRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const role = localStorage.getItem("userRole");

  if (!isAuthenticated || role !== "equipe") {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <div className="App">
        {/* We move the header inside a layout or check route to conditionally render it,
            but for now, let's keep it simple. If we want no header on login, we'd need a layout wrapper.
            Actually, let's hide the main-container styles for Login by not wrapping Login in it.
        */}

        <Routes>
          {/* Login Route - No Main Container/Header wrapper to keep it clean */}
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/admin" element={
            <AdminRoute>
              <AdminPanel />
            </AdminRoute>
          } />

          <Route path="/team" element={
            <TeamRoute>
              <TeamDashboard />
            </TeamRoute>
          } />

          {/* Protected Routes */}
          <Route path="/form" element={
            <ProtectedRoute>
              <div className="main-container">
                <header className="app-header">
                  <h1 className="app-title">Planning de Construction</h1>
                </header>
                <ProjectForm />
              </div>
            </ProtectedRoute>
          } />

          <Route path="/gantt" element={
            <ProtectedRoute>
              <div className="main-container">
                <header className="app-header">
                  <h1 className="app-title">Planning de Construction</h1>
                </header>
                <GanttChart />
              </div>
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
