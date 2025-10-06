import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  attendanceRecord?: any;
  selectedDate: Date;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

const AdminAttendanceDialog = ({ 
  open, 
  onOpenChange, 
  onSuccess,
  attendanceRecord,
  selectedDate
}: AdminAttendanceDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [date, setDate] = useState<Date>(selectedDate);
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [status, setStatus] = useState("present");

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (attendanceRecord) {
        // Edit mode
        setSelectedUserId(attendanceRecord.user_id);
        setDate(new Date(attendanceRecord.date));
        setCheckInTime(attendanceRecord.check_in_time ? format(new Date(attendanceRecord.check_in_time), "HH:mm") : "");
        setCheckOutTime(attendanceRecord.check_out_time ? format(new Date(attendanceRecord.check_out_time), "HH:mm") : "");
        setStatus(attendanceRecord.status);
      } else {
        // Add mode
        resetForm();
      }
    }
  }, [open, attendanceRecord, selectedDate]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc('get_public_profiles');
    if (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
      return;
    }
    setUsers((data || []) as UserProfile[]);
  };

  const resetForm = () => {
    setSelectedUserId("");
    setDate(selectedDate);
    setCheckInTime("");
    setCheckOutTime("");
    setStatus("present");
  };

  const calculateHoursAndPayCut = (checkIn: string, checkOut: string, hourlyRate: number | null) => {
    const checkInDate = new Date(`${format(date, 'yyyy-MM-dd')}T${checkIn}`);
    const checkOutDate = checkOut ? new Date(`${format(date, 'yyyy-MM-dd')}T${checkOut}`) : null;

    // Calculate late minutes (assuming 9 AM start)
    const workStartHour = 9;
    const todayWorkStart = new Date(date);
    todayWorkStart.setHours(workStartHour, 0, 0, 0);
    
    let lateMinutes = 0;
    let isLate = false;
    if (checkInDate > todayWorkStart) {
      lateMinutes = Math.round((checkInDate.getTime() - todayWorkStart.getTime()) / (1000 * 60));
      isLate = lateMinutes > 0;
    }

    let totalHours = null;
    let earlyDepartureMinutes = 0;

    if (checkOutDate) {
      totalHours = Number(((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60)).toFixed(2));
      
      // Calculate early departure (assuming 8-hour workday ending at 5 PM)
      const workEndHour = 17;
      const todayWorkEnd = new Date(date);
      todayWorkEnd.setHours(workEndHour, 0, 0, 0);
      
      if (checkOutDate < todayWorkEnd) {
        earlyDepartureMinutes = Math.round((todayWorkEnd.getTime() - checkOutDate.getTime()) / (1000 * 60));
      }
    }

    // Calculate pay cut
    let payCut = 0;
    if (hourlyRate) {
      const totalViolationMinutes = lateMinutes + earlyDepartureMinutes;
      if (totalViolationMinutes > 0) {
        if (totalViolationMinutes <= 60) {
          payCut = (totalViolationMinutes / 60) * hourlyRate;
        } else {
          payCut = hourlyRate + ((totalViolationMinutes - 60) / 60) * hourlyRate * 1.5;
        }
        payCut = Math.round(payCut * 100) / 100;
      }
    }

    return {
      isLate,
      lateMinutes,
      totalHours,
      earlyDepartureMinutes,
      payCut
    };
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !checkInTime) {
      toast({
        title: "Validation Error",
        description: "Please select a user and provide check-in time",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get user's hourly rate from profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('user_id', selectedUserId)
        .single();

      const calculations = calculateHoursAndPayCut(checkInTime, checkOutTime, profileData?.hourly_rate || null);

      const attendanceData = {
        user_id: selectedUserId,
        date: format(date, 'yyyy-MM-dd'),
        check_in_time: `${format(date, 'yyyy-MM-dd')}T${checkInTime}:00`,
        check_out_time: checkOutTime ? `${format(date, 'yyyy-MM-dd')}T${checkOutTime}:00` : null,
        status: status as "present" | "absent" | "late",
        is_late: calculations.isLate,
        late_minutes: calculations.lateMinutes,
        total_hours: calculations.totalHours,
        early_departure_minutes: calculations.earlyDepartureMinutes,
        pay_cut_amount: calculations.payCut,
        pay_cut_approved: false
      };

      if (attendanceRecord) {
        // Update existing record
        const { error } = await supabase
          .from('attendance')
          .update(attendanceData)
          .eq('id', attendanceRecord.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Attendance record updated successfully",
        });
      } else {
        // Create new record
        const { error } = await supabase
          .from('attendance')
          .insert([attendanceData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Attendance record created successfully",
        });
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save attendance record",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {attendanceRecord ? "Edit Attendance" : "Add Attendance Record"}
          </DialogTitle>
          <DialogDescription>
            {attendanceRecord 
              ? "Update the attendance record for the selected employee"
              : "Manually add an attendance record for an employee"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="user">Employee</Label>
            <Select 
              value={selectedUserId} 
              onValueChange={setSelectedUserId}
              disabled={!!attendanceRecord}
            >
              <SelectTrigger id="user">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="half-day">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check In Time</Label>
              <Input
                id="checkIn"
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOut">Check Out Time</Label>
              <Input
                id="checkOut"
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : attendanceRecord ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAttendanceDialog;
