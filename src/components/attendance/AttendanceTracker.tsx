import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Clock, LogIn, LogOut, Timer } from "lucide-react";
import { format } from "date-fns";

interface TodayAttendance {
  id?: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | null;
  status: string;
  late_minutes: number | null;
  early_departure_minutes: number | null;
  pay_cut_amount: number | null;
  pay_cut_approved: boolean;
}

const AttendanceTracker = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTodayAttendance();
    }
  }, [user]);

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user?.id)
        .eq('date', today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching attendance:', error);
        toast({
          title: "Error",
          description: "Failed to load attendance data",
          variant: "destructive",
        });
      }

      setTodayAttendance(data);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Get company settings for work hours
      const { data: settings } = await supabase
        .from('company_settings')
        .select('daily_working_hours')
        .single();
      
      // Calculate late minutes (assuming 9 AM start time by default)
      const workStartHour = 9; // Default 9 AM
      const todayWorkStart = new Date(now);
      todayWorkStart.setHours(workStartHour, 0, 0, 0);
      
      let lateMinutes = 0;
      let isLate = false;
      if (now > todayWorkStart) {
        lateMinutes = Math.round((now.getTime() - todayWorkStart.getTime()) / (1000 * 60));
        isLate = lateMinutes > 0;
      }
      
      // Get user's hourly rate for pay cut calculation
      const { data: profile } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('user_id', user?.id)
        .single();
      
      // Calculate pay cut if late
      let payCut = 0;
      if (lateMinutes > 0 && profile?.hourly_rate) {
        if (lateMinutes <= 60) {
          payCut = (lateMinutes / 60) * profile.hourly_rate;
        } else {
          payCut = profile.hourly_rate + ((lateMinutes - 60) / 60) * profile.hourly_rate * 1.5;
        }
        payCut = Math.round(payCut * 100) / 100;
      }
      
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          user_id: user?.id,
          date: today,
          check_in_time: now.toISOString(),
          status: 'present',
          is_late: isLate,
          late_minutes: lateMinutes,
          pay_cut_amount: payCut
        })
        .select()
        .single();

      if (error) {
        console.error('Check-in error:', error);
        toast({
          title: "Check-in Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: lateMinutes > 0 
            ? `Checked in successfully! You are ${lateMinutes} minute(s) late.`
            : "Checked in successfully!",
        });
        setTodayAttendance(data);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      toast({
        title: "Check-in Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayAttendance) return;
    
    setActionLoading(true);
    try {
      const now = new Date();
      const checkInTime = new Date(todayAttendance.check_in_time!);
      const totalHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      
      // Get company settings for work hours
      const { data: settings } = await supabase
        .from('company_settings')
        .select('daily_working_hours')
        .single();
      
      // Calculate early departure (assuming standard 9 AM - 5 PM, or 8 hours)
      const dailyHours = settings?.daily_working_hours || 8;
      const workStartHour = 9;
      const workEndHour = workStartHour + dailyHours;
      const todayWorkEnd = new Date(now);
      todayWorkEnd.setHours(workEndHour, 0, 0, 0);
      
      let earlyDepartureMinutes = 0;
      if (now < todayWorkEnd) {
        earlyDepartureMinutes = Math.round((todayWorkEnd.getTime() - now.getTime()) / (1000 * 60));
      }
      
      // Get user's hourly rate and current late minutes for total pay cut
      const { data: profile } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('user_id', user?.id)
        .single();
      
      // Calculate total pay cut (late + early departure)
      const totalViolationMinutes = (todayAttendance.late_minutes || 0) + earlyDepartureMinutes;
      let totalPayCut = todayAttendance.pay_cut_amount || 0;
      
      if (earlyDepartureMinutes > 0 && profile?.hourly_rate) {
        // Calculate additional pay cut for early departure
        const remainingFromLate = Math.max(0, 60 - (todayAttendance.late_minutes || 0));
        if (earlyDepartureMinutes <= remainingFromLate) {
          totalPayCut += (earlyDepartureMinutes / 60) * profile.hourly_rate;
        } else {
          totalPayCut += (remainingFromLate / 60) * profile.hourly_rate;
          totalPayCut += ((earlyDepartureMinutes - remainingFromLate) / 60) * profile.hourly_rate * 1.5;
        }
        totalPayCut = Math.round(totalPayCut * 100) / 100;
      }
      
      const { data, error } = await supabase
        .from('attendance')
        .update({
          check_out_time: now.toISOString(),
          total_hours: Number(totalHours.toFixed(2)),
          early_departure_minutes: earlyDepartureMinutes,
          pay_cut_amount: totalPayCut
        })
        .eq('id', todayAttendance.id)
        .select()
        .single();

      if (error) {
        console.error('Check-out error:', error);
        toast({
          title: "Check-out Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: earlyDepartureMinutes > 0
            ? `Checked out early by ${earlyDepartureMinutes} minute(s).`
            : "Checked out successfully!",
        });
        setTodayAttendance(data);
      }
    } catch (error) {
      console.error('Check-out error:', error);
      toast({
        title: "Check-out Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isCheckedIn = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
  const isCompleted = todayAttendance?.check_in_time && todayAttendance?.check_out_time;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Today's Attendance</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={isCheckedIn ? "default" : isCompleted ? "secondary" : "outline"}>
                {isCheckedIn ? "Checked In" : isCompleted ? "Completed" : "Not Started"}
              </Badge>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">{format(new Date(), "PPP")}</p>
            </div>
          </div>

          {todayAttendance?.check_in_time && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center">
                  <LogIn className="h-4 w-4 mr-1" />
                  Check In
                </p>
                <p className="font-medium">
                  {format(new Date(todayAttendance.check_in_time), "HH:mm:ss")}
                </p>
              </div>
              
              {todayAttendance.check_out_time && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center">
                    <LogOut className="h-4 w-4 mr-1" />
                    Check Out
                  </p>
                  <p className="font-medium">
                    {format(new Date(todayAttendance.check_out_time), "HH:mm:ss")}
                  </p>
                </div>
              )}
            </div>
          )}

          {todayAttendance?.total_hours && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center">
                <Timer className="h-4 w-4 mr-1" />
                Total Hours
              </p>
              <p className="text-lg font-bold text-primary">
                {todayAttendance.total_hours} hours
              </p>
            </div>
          )}

          {(todayAttendance?.late_minutes || todayAttendance?.early_departure_minutes) && todayAttendance.pay_cut_amount ? (
            <div className="space-y-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">Pay Cut Warning</p>
              {todayAttendance.late_minutes > 0 && (
                <p className="text-xs text-muted-foreground">
                  Late: {todayAttendance.late_minutes} minute(s)
                </p>
              )}
              {todayAttendance.early_departure_minutes > 0 && (
                <p className="text-xs text-muted-foreground">
                  Early departure: {todayAttendance.early_departure_minutes} minute(s)
                </p>
              )}
              <p className="text-sm font-bold text-destructive">
                Potential pay cut: ${todayAttendance.pay_cut_amount.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {todayAttendance.pay_cut_approved 
                  ? "Approved by manager" 
                  : "Pending manager approval"}
              </p>
            </div>
          ) : null}

          <div className="pt-4">
            {!todayAttendance?.check_in_time ? (
              <Button 
                onClick={handleCheckIn} 
                disabled={actionLoading}
                className="w-full"
                size="lg"
              >
                <LogIn className="mr-2 h-4 w-4" />
                {actionLoading ? "Checking In..." : "Check In"}
              </Button>
            ) : !todayAttendance?.check_out_time ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={actionLoading}
                    variant="destructive"
                    className="w-full"
                    size="lg"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {actionLoading ? "Checking Out..." : "Check Out"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Check Out</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to check out? This will end your work session for today.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCheckOut}>
                      Yes, Check Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-muted-foreground">
                  You have completed your attendance for today!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceTracker;