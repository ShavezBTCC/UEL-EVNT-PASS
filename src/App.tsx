import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import EventDashboard from "@/pages/EventDashboard";
import Scanner from "@/pages/Scanner";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/event/:id" element={<EventDashboard />} />
      <Route path="/scan/:id" element={<Scanner />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
