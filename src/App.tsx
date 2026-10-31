import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";

const EventDashboard = lazy(() => import("./pages/EventDashboard"));
const Scanner = lazy(() => import("./pages/Scanner"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="grid min-h-dvh place-items-center text-slate-400">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/event/:id" element={<EventDashboard />} />
          <Route path="/scan/:id" element={<Scanner />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
