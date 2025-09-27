import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/layout/Navigation";
import AttendanceTracker from "@/components/attendance/AttendanceTracker";
import TeamAttendance from "@/components/attendance/TeamAttendance";
import UserManagement from "@/components/users/UserManagement";
import ProjectManagement from "@/components/projects/ProjectManagement";
import TaskManagement from "@/components/tasks/TaskManagement";
import Overtime from "./Overtime";
import OvertimeApproval from "@/components/overtime/OvertimeApproval";
import Dashboard from "@/components/dashboard/Dashboard";

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("attendance");
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render anything if not authenticated (navigation will handle redirect)
  if (!user) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "attendance":
        return <AttendanceTracker />;
      case "overtime":
        return <Overtime />;
      case "overtime-approval":
        return <OvertimeApproval />;
      case "tasks":
        return <TaskManagement />;
      case "dashboard":
        return <Dashboard />;
      case "team-attendance":
        return <TeamAttendance />;
      case "projects":
        return <ProjectManagement />;
      case "users":
        return <UserManagement />;
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
