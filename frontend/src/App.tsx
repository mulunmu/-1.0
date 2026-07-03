import { BrowserRouter, Route, Routes } from "react-router-dom";
import MockDataBanner from "@/components/MockDataBanner";
import ChatPanel from "@/pages/ChatPanel";
import Dashboard from "@/pages/Dashboard";
import EnterpriseDetail from "@/pages/EnterpriseDetail";
import EnterprisePK from "@/pages/EnterprisePK";
import RiskWarnings from "@/pages/RiskWarnings";

export default function App() {
  return (
    <BrowserRouter>
      <MockDataBanner />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/enterprise/:id" element={<EnterpriseDetail />} />
        <Route path="/pk" element={<EnterprisePK />} />
        <Route path="/warnings" element={<RiskWarnings />} />
        <Route path="/chat" element={<ChatPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
