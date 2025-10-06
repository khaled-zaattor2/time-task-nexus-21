import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Clock, 
  Calendar, 
  CheckSquare, 
  Users, 
  Settings, 
  LogOut,
  User,
  BarChart3,
  FileText,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const { user, profile, signOut, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const employeeNavItems = [
    { id: "attendance", label: "Attendance", icon: Clock },
    { id: "tasks", label: "My Tasks", icon: CheckSquare },
    { id: "overtime", label: "Overtime", icon: Calendar },
  ];

  const adminNavItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "team-attendance", label: "Team Attendance", icon: Clock },
    { id: "tasks", label: "Task Management", icon: CheckSquare },
    { id: "projects", label: "Projects", icon: FileText },
    { id: "users", label: "Users", icon: Users },
    { id: "overtime-approval", label: "Overtime Approval", icon: Calendar },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const navItems = isAdmin ? adminNavItems : employeeNavItems;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <Clock className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">AttendanceHub</span>
            </div>
            
            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={activeTab === item.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "flex items-center space-x-2",
                      activeTab === item.id && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px]">
                <nav className="flex flex-col space-y-2 mt-8">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        variant={activeTab === item.id ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => {
                          onTabChange(item.id);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        <span>{item.label}</span>
                      </Button>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            <Badge variant={isAdmin ? "default" : "secondary"}>
              {profile?.role || "User"}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">
                    {profile?.full_name || "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => onTabChange("profile")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navigation;