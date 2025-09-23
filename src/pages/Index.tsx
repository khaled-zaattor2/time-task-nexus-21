import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/layout/Navigation";
import AttendanceTracker from "@/components/attendance/AttendanceTracker";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("attendance");

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect to auth page if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "attendance":
        return <AttendanceTracker />;
      case "tasks":
        return <div className="p-6">Tasks coming soon...</div>;
      case "overtime":
        return <div className="p-6">Overtime management coming soon...</div>;
      case "dashboard":
        return <div className="p-6">Admin dashboard coming soon...</div>;
      case "team-attendance":
        return <div className="p-6">Team attendance coming soon...</div>;
      case "projects":
        return <div className="p-6">Project management coming soon...</div>;
      case "users":
        return <div className="p-6">User management coming soon...</div>;
      case "overtime-approval":
        return <div className="p-6">Overtime approval coming soon...</div>;
      case "settings":
        return <div className="p-6">Settings coming soon...</div>;
      case "profile":
        return <div className="p-6">Profile management coming soon...</div>;
      default:
        return <AttendanceTracker />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="container mx-auto px-4 py-6">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
