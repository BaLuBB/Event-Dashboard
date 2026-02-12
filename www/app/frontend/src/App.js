// FILE: /var/www/app/frontend/src/App.js
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import ViewerDashboard from "@/pages/ViewerDashboard";
import CrewDashboard from "@/pages/CrewDashboard";
import CurrentDashboard from "@/pages/CurrentDashboard";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App min-h-screen bg-background text-foreground noise-bg">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<ViewerDashboard />} />
              <Route path="/crew" element={<CrewDashboard />} />
              <Route path="/current" element={<CurrentDashboard />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
