import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building,
  Clock,
  Bell,
  Shield,
  Save,
  Users,
  Calendar,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { format } from "date-fns";

const Settings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Company Settings State
  const [companyName, setCompanyName] = useState("AttendanceHub Inc.");
  const [workingHours, setWorkingHours] = useState({
    start: "09:00",
    end: "17:00",
  });
  const [timezone, setTimezone] = useState("UTC");
  
  // Working Days State
  const [workingDays, setWorkingDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });

  // Holidays State
  const [holidays, setHolidays] = useState<Date[]>([]);
  const [selectedHoliday, setSelectedHoliday] = useState<Date | undefined>();

  // Notification Settings State
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    tardyAlerts: true,
    overtimeAlerts: true,
    weeklyReports: false,
  });

  // Security Settings State
  const [security, setSecurity] = useState({
    sessionTimeout: "8",
    requirePasswordChange: false,
    twoFactorAuth: false,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: settings, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (settings) {
        setSettingsId(settings.id);
        
        // Load working days from database
        if (settings.working_days) {
          const days = settings.working_days as string[];
          setWorkingDays({
            monday: days.includes('monday'),
            tuesday: days.includes('tuesday'),
            wednesday: days.includes('wednesday'),
            thursday: days.includes('thursday'),
            friday: days.includes('friday'),
            saturday: days.includes('saturday'),
            sunday: days.includes('sunday'),
          });
        }

        // Load working hours
        if (settings.daily_working_hours) {
          const hours = Number(settings.daily_working_hours);
          const startHour = 9; // Default start
          const endHour = startHour + hours;
          setWorkingHours({
            start: `${startHour.toString().padStart(2, '0')}:00`,
            end: `${endHour.toString().padStart(2, '0')}:00`,
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSaveSettings = async (section: string) => {
    setLoading(true);
    try {
      if (section === "Work Hours") {
        // Convert working days object to array
        const workingDaysArray = Object.entries(workingDays)
          .filter(([_, isWorking]) => isWorking)
          .map(([day]) => day);

        // Calculate daily working hours
        const startMinutes = parseInt(workingHours.start.split(':')[0]) * 60 + parseInt(workingHours.start.split(':')[1]);
        const endMinutes = parseInt(workingHours.end.split(':')[0]) * 60 + parseInt(workingHours.end.split(':')[1]);
        const dailyHours = (endMinutes - startMinutes) / 60;

        if (settingsId) {
          // Update existing settings
          const { error } = await supabase
            .from('company_settings')
            .update({
              working_days: workingDaysArray,
              daily_working_hours: dailyHours,
            })
            .eq('id', settingsId);

          if (error) throw error;
        } else {
          // Insert new settings
          const { data, error } = await supabase
            .from('company_settings')
            .insert({
              working_days: workingDaysArray,
              daily_working_hours: dailyHours,
            })
            .select()
            .single();

          if (error) throw error;
          if (data) setSettingsId(data.id);
        }
      }
      
      toast({
        title: "Settings Saved",
        description: `${section} settings have been updated successfully.`,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">System Settings</h1>
        <Badge variant="secondary">Admin Only</Badge>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company" className="flex items-center space-x-2">
            <Building className="h-4 w-4" />
            <span>Company</span>
          </TabsTrigger>
          <TabsTrigger value="work-hours" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Work Hours</span>
          </TabsTrigger>
          <TabsTrigger value="holidays" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Holidays</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Manage your organization's basic information and settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone">Default Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="EST">Eastern Standard Time</SelectItem>
                      <SelectItem value="PST">Pacific Standard Time</SelectItem>
                      <SelectItem value="CST">Central Standard Time</SelectItem>
                      <SelectItem value="MST">Mountain Standard Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Separator />
              
              <Button 
                onClick={() => handleSaveSettings("Company")}
                disabled={loading}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Company Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work-hours">
          <Card>
            <CardHeader>
              <CardTitle>Work Hours Configuration</CardTitle>
              <CardDescription>
                Set default working hours and attendance policies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={workingHours.start}
                      onChange={(e) => setWorkingHours(prev => ({
                        ...prev,
                        start: e.target.value
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">End Time</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={workingHours.end}
                      onChange={(e) => setWorkingHours(prev => ({
                        ...prev,
                        end: e.target.value
                      }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Working Days</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(workingDays).map(([day, checked]) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={day}
                          checked={checked}
                          onCheckedChange={(checked) =>
                            setWorkingDays((prev) => ({ ...prev, [day]: checked as boolean }))
                          }
                        />
                        <Label htmlFor={day} className="capitalize cursor-pointer">
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Current Schedule</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Standard work day: {workingHours.start} - {workingHours.end}
                    ({((parseInt(workingHours.end.split(':')[0]) * 60 + parseInt(workingHours.end.split(':')[1])) - (parseInt(workingHours.start.split(':')[0]) * 60 + parseInt(workingHours.start.split(':')[1]))) / 60} hours)
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Working days: {Object.entries(workingDays)
                      .filter(([_, checked]) => checked)
                      .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
                      .join(", ")}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <Button 
                onClick={() => handleSaveSettings("Work Hours")}
                disabled={loading}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Work Hours
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays">
          <Card>
            <CardHeader>
              <CardTitle>Holiday Management</CardTitle>
              <CardDescription>
                Manage company holidays and non-working days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <Label>Select Holiday Date</Label>
                  <CalendarComponent
                    mode="single"
                    selected={selectedHoliday}
                    onSelect={setSelectedHoliday}
                    className="rounded-md border"
                  />
                  <Button
                    onClick={() => {
                      if (selectedHoliday && !holidays.some(h => h.getTime() === selectedHoliday.getTime())) {
                        setHolidays([...holidays, selectedHoliday]);
                        setSelectedHoliday(undefined);
                        toast({
                          title: "Holiday Added",
                          description: `${format(selectedHoliday, "PPP")} has been added to holidays.`,
                        });
                      }
                    }}
                    disabled={!selectedHoliday}
                    className="w-full"
                  >
                    Add Holiday
                  </Button>
                </div>

                <div className="space-y-4">
                  <Label>Scheduled Holidays ({holidays.length})</Label>
                  <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                    {holidays.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No holidays scheduled
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {holidays
                          .sort((a, b) => a.getTime() - b.getTime())
                          .map((holiday, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div className="flex items-center space-x-3">
                                <Calendar className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  {format(holiday, "PPP")}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setHolidays(holidays.filter((_, i) => i !== index));
                                  toast({
                                    title: "Holiday Removed",
                                    description: `${format(holiday, "PPP")} has been removed.`,
                                  });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <Button
                onClick={() => handleSaveSettings("Holidays")}
                disabled={loading}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Holiday Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure system notifications and alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for important events
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailAlerts}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, emailAlerts: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Tardy Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Alert managers when employees are late
                    </p>
                  </div>
                  <Switch
                    checked={notifications.tardyAlerts}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, tardyAlerts: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Overtime Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify about overtime requests and approvals
                    </p>
                  </div>
                  <Switch
                    checked={notifications.overtimeAlerts}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, overtimeAlerts: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Send weekly attendance summary reports
                    </p>
                  </div>
                  <Switch
                    checked={notifications.weeklyReports}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, weeklyReports: checked }))
                    }
                  />
                </div>
              </div>
              
              <Separator />
              
              <Button 
                onClick={() => handleSaveSettings("Notifications")}
                disabled={loading}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage security policies and authentication settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
                  <Select 
                    value={security.sessionTimeout} 
                    onValueChange={(value) => 
                      setSecurity(prev => ({ ...prev, sessionTimeout: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="4">4 hours</SelectItem>
                      <SelectItem value="8">8 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Password Change</Label>
                    <p className="text-sm text-muted-foreground">
                      Force users to change password every 90 days
                    </p>
                  </div>
                  <Switch
                    checked={security.requirePasswordChange}
                    onCheckedChange={(checked) => 
                      setSecurity(prev => ({ ...prev, requirePasswordChange: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Require 2FA for all admin accounts
                    </p>
                  </div>
                  <Switch
                    checked={security.twoFactorAuth}
                    onCheckedChange={(checked) => 
                      setSecurity(prev => ({ ...prev, twoFactorAuth: checked }))
                    }
                  />
                </div>
              </div>
              
              <Separator />
              
              <Button 
                onClick={() => handleSaveSettings("Security")}
                disabled={loading}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Security Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;