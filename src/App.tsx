/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginView from './components/LoginView';
import PredictorView from './components/PredictorView';
import AdminView from './components/AdminView';

// Protected Route for Predictor
const PredictorRoute = () => {
  const savedKey = localStorage.getItem('active_bdt_key');
  if (!savedKey) {
    return <Navigate to="/" replace />;
  }
  return <PredictorView onLogout={() => {
    localStorage.removeItem('active_bdt_key');
    window.location.href = '/';
  }} />;
};

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#050c26]">
        <Routes>
          {/* Main User Entry - Shows Login or redirects to Prediction if key exists */}
          <Route path="/" element={
            localStorage.getItem('active_bdt_key') ? 
            <Navigate to="/prediction" replace /> : 
            <LoginView 
              onLogin={() => window.location.href = '/prediction'} 
            />
          } />
          
          {/* Prediction Link */}
          <Route path="/prediction" element={<PredictorRoute />} />
          
          {/* Separate Admin Link */}
          <Route path="/admin-access-control" element={<AdminView />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

