/*
 * Copyright 2024 Control Drift Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Target, Shield, FileText, Settings as SettingsIcon, Activity, ListTodo, ChevronLeft, ChevronRight, Command, Menu, X, Globe } from 'lucide-react';
import CustomLogo from './components/ui/CustomLogo';

import AIAssistant from './components/features/AIAssistant';
import CommandPalette from './components/ui/CommandPalette';

const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        return;
      }
      throw error;
    }
  });

const Dashboard = lazyWithRetry(() => import('./components/pages/Dashboard'));
const SimulationWizard = lazyWithRetry(() => import('./components/pages/SimulationWizard'));
const GapTracker = lazyWithRetry(() => import('./components/pages/GapTracker'));
const GapDetails = lazyWithRetry(() => import('./components/features/GapDetails'));
const Reports = lazyWithRetry(() => import('./components/pages/Reports'));
const Settings = lazyWithRetry(() => import('./components/pages/Settings'));
const MitreHeatmap = lazyWithRetry(() => import('./components/pages/MitreHeatmap'));
const AttackPath = lazyWithRetry(() => import('./components/features/AttackPath'));

import { AppProvider, useAppContext } from './AppContext';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import AuthScreen from './components/ui/AuthScreen';


function AppContent() {
   const { isDbLoading, isAuthenticated, dbAdapter, setIsAuthenticated, loadData, dbConfig } = useAppContext();
   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
   const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
   const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

   useEffect(() => {
     const handleResize = () => setIsMobile(window.innerWidth <= 768);
     window.addEventListener('resize', handleResize);
     return () => window.removeEventListener('resize', handleResize);
   }, []);
   
   const effectiveIsSidebarCollapsed = isSidebarCollapsed && !isMobile;
   
   useEffect(() => {
    if (effectiveIsSidebarCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [effectiveIsSidebarCollapsed]);

   const handleNavClick = () => {
     if (isMobile) {
       setIsMobileMenuOpen(false);
     }
   };

   const handleLoginSuccess = async () => {
       setIsAuthenticated(true);
       await loadData(dbAdapter);
   };

   return (
       <>
           {isDbLoading && (
               <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', zIndex: 999999 }}>
                   <div style={{ zoom: 1.5, marginBottom: '30px' }}>
                       <CustomLogo />
                   </div>
                   <div style={{ color: 'var(--text-secondary)' }}>Establishing connection...</div>
               </div>
           )}
           {/* Background Animations Removed */}
           {!isDbLoading && !isAuthenticated && dbConfig?.provider !== 'local' && (
               <AuthScreen onLogin={handleLoginSuccess} dbAdapter={dbAdapter} />
           )}
           
           {!isDbLoading && (isAuthenticated || dbConfig?.provider === 'local') && (
             <Router>
               <div className={`app-container ${effectiveIsSidebarCollapsed ? 'collapsed' : ''}`} style={{ display: isDbLoading ? 'none' : 'flex' }}>
               <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''} ${effectiveIsSidebarCollapsed ? 'collapsed' : ''}`}>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0', overflow: 'hidden', width: '100%', justifyContent: effectiveIsSidebarCollapsed ? 'center' : 'flex-start', paddingLeft: effectiveIsSidebarCollapsed ? '0' : '16px' }}>
                     {effectiveIsSidebarCollapsed ? <CustomLogo iconOnly={true} style={{ width: '28px', height: '28px' }} /> : <CustomLogo style={{ gap: '0px' }} />}
                   </div>
                   
                   <button className="mobile-only" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '8px', borderRadius: '8px', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
                     {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                   </button>
                 </div>
                 
                 <div className="sidebar-nav-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                     <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                         <LayoutDashboard size={20} /><span className="nav-label">Dashboard</span>
                       </NavLink>
                       <NavLink to="/simulation" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                         <Target size={20} /><span className="nav-label">Simulation Launcher</span>
                       </NavLink>
                       <NavLink to="/posture" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                         <Globe size={20} /><span className="nav-label">Heat Globe</span>
                       </NavLink>
                       <NavLink to="/gaps" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                         <ListTodo size={20} /><span className="nav-label">Gap Tracker</span>
                       </NavLink>
                        <NavLink to="/attack-path" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                          <Command size={20} /><span className="nav-label">Attack Path</span>
                        </NavLink>
                       <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                         <FileText size={20} /><span className="nav-label">Reports</span>
                       </NavLink>
                     </nav>
                     
                      {/* Clickable empty space to toggle sidebar */}
                      <div 
                        className="desktop-only sidebar-toggle-zone"
                        style={{ flex: 1, cursor: 'pointer', minHeight: '40px' }}
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                      />
                     
                     <div style={{ paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                       <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                         <SettingsIcon size={20} /><span className="nav-label">Settings</span>
                       </NavLink>
                       <div className="hide-on-mobile" style={{ padding: '10px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>Ctrl</kbd> + <kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>K</kbd> Global Search
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>Ctrl</kbd> + <kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>J</kbd> AI Assistant
                         </div>
                       </div>
                     </div>
                 </div>
               </aside>
               
               <main className="main-content">
                  <Suspense fallback={
                    <div className="glass-panel animate-fade-in" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <p>Loading view...</p>
                    </div>
                  }>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/simulation" element={<SimulationWizard />} />
                      <Route path="/posture" element={<MitreHeatmap />} />
                      <Route path="/gaps" element={<GapTracker />} />
                      <Route path="/gaps/:id" element={<GapDetails />} />
                      <Route path="/attack-path" element={<AttackPath />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </main>
               
               <CommandPalette />
               <AIAssistant />
             </div>
           </Router>
           )}
       </>
   );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
