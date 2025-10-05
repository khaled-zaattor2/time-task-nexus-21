import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Users, Calendar as CalendarIcon, Clock, TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminAttendanceDialog from "./AdminAttendanceDialog";

interface TeamAttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_hours: number | null;
  status: string;
  is_late: boolean;
  full_name: string;
  email: string;
  late_minutes: number | null;
  early_departure_minutes: number | null;
  pay_cut_amount: number | null;
  pay_cut_approved: boolean;
  pay_cut_approved_by: string | null;
  pay_cut_approved_at: string | null;
}

const TeamAttendance = () => {
  const { user, isAdmin } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<TeamAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TeamAttendanceRecord | undefined>(undefined);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchTeamAttendance();
    }
  }, [user, isAdmin, selectedDate]);

  const fetchTeamAttendance = async () => {
    if (!user || !isAdmin) return;

    try {
      setLoading(true);

      const dateString = format(selectedDate, 'yyyy-MM-dd');

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', dateString);

      if (attendanceError) throw attendanceError;

      const userIds = Array.from(new Set((attendanceData ?? []).map((r: any) => r.user_id))).filter(Boolean);

      let profilesMap = new Map<string, { full_name: string; email: string }>();
      if (userIds.length > 0) {
        // Use secure function to safely access employee names/emails without exposing salary data
        const { data: profilesData, error: profilesError } = await supabase
          .rpc('get_public_profiles');
        if (profilesError) throw profilesError;
        // Filter to only the users we need
        const filteredProfiles = (profilesData ?? []).filter((p: any) => userIds.includes(p.user_id));
        profilesMap = new Map(filteredProfiles.map((p: any) => [p.user_id, { full_name: p.full_name, email: p.email }]));
      }
      
      const transformedData = (attendanceData || []).map((record: any) => {
        const profile = profilesMap.get(record.user_id) || { full_name: 'Unknown', email: '' };
        return {
          ...record,
          full_name: profile.full_name,
          email: profile.email,
        } as TeamAttendanceRecord;
      });
      
      // Sort by employee name
      transformedData.sort((a, b) => a.full_name.localeCompare(b.full_name));
      
      setAttendanceRecords(transformedData);
    } catch (error) {
      console.error('Error fetching team attendance:', error);
      toast({
        title: "Error",
        description: "Failed to load team attendance",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayCut = async (attendanceId: string) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({
          pay_cut_approved: true,
          pay_cut_approved_by: user?.id,
          pay_cut_approved_at: new Date().toISOString()
        })
        .eq('id', attendanceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pay cut approved successfully",
      });

      fetchTeamAttendance();
    } catch (error) {
      console.error('Error approving pay cut:', error);
      toast({
        title: "Error",
        description: "Failed to approve pay cut",
        variant: "destructive",
      });
    }
  };

  const handleAddAttendance = () => {
    setEditingRecord(undefined);
    setDialogOpen(true);
  };

  const handleEditAttendance = (record: TeamAttendanceRecord) => {
    setEditingRecord(record);
    setDialogOpen(true);
  };

  const handleDeleteAttendance = async (attendanceId: string) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', attendanceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance record deleted successfully",
      });

      fetchTeamAttendance();
      setDeleteRecordId(null);
    } catch (error) {
      console.error('Error deleting attendance:', error);
      toast({
        title: "Error",
        description: "Failed to delete attendance record",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, isLate: boolean) => {
    if (status === 'present') {
      return (
        <Badge variant={isLate ? "destructive" : "default"}>
          {isLate ? "Late" : "Present"}
        </Badge>
      );
    }
    if (status === 'absent') {
      return <Badge variant="secondary">Absent</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const filteredRecords = attendanceRecords.filter(record =>
    record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPresent = filteredRecords.filter(r => r.status === 'present').length;
  const totalAbsent = filteredRecords.filter(r => r.status === 'absent').length;
  const totalLate = filteredRecords.filter(r => r.is_late).length;
  const avgHours = filteredRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0) / filteredRecords.length || 0;

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Access denied. Admin privileges required.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading team attendance...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Present</p>
                <p className="text-2xl font-bold text-green-600">{totalPresent}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-red-600">{totalAbsent}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Late Arrivals</p>
                <p className="text-2xl font-bold text-orange-600">{totalLate}</p>
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Hours</p>
                <p className="text-2xl font-bold">{avgHours.toFixed(1)}h</p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Attendance
              </CardTitle>
              <CardDescription>
                Monitor team attendance for {format(selectedDate, 'MMMM dd, yyyy')}
              </CardDescription>
            </div>
            <Button onClick={handleAddAttendance}>
              <Plus className="h-4 w-4 mr-2" />
              Add Attendance
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No attendance records found for this date</p>
              <p className="text-sm">Check a different date or ensure employees have checked in</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Violations</TableHead>
                    <TableHead>Pay Cut</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.full_name}</div>
                          <div className="text-sm text-muted-foreground">{record.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record.status, record.is_late)}
                      </TableCell>
                      <TableCell>
                        {record.check_in_time ? (
                          <span className={cn(
                            "text-sm",
                            record.is_late ? "text-red-600" : "text-green-600"
                          )}>
                            {format(new Date(record.check_in_time), 'HH:mm')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.check_out_time ? (
                          <span className="text-sm">
                            {format(new Date(record.check_out_time), 'HH:mm')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(record.late_minutes || record.early_departure_minutes) ? (
                          <div className="space-y-1">
                            {record.late_minutes > 0 && (
                              <div className="text-xs text-destructive">
                                Late: {record.late_minutes}m
                              </div>
                            )}
                            {record.early_departure_minutes > 0 && (
                              <div className="text-xs text-orange-600">
                                Early: {record.early_departure_minutes}m
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.pay_cut_amount && record.pay_cut_amount > 0 ? (
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-destructive">
                              ${record.pay_cut_amount.toFixed(2)}
                            </div>
                            <Badge 
                              variant={record.pay_cut_approved ? "default" : "outline"}
                              className="text-xs"
                            >
                              {record.pay_cut_approved ? "Approved" : "Pending"}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {record.total_hours ? `${record.total_hours}h` : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {record.pay_cut_amount && record.pay_cut_amount > 0 && !record.pay_cut_approved && (
                            <Button
                              size="sm"
                              onClick={() => handleApprovePayCut(record.id)}
                              variant="outline"
                            >
                              Approve Cut
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditAttendance(record)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog open={deleteRecordId === record.id} onOpenChange={(open) => !open && setDeleteRecordId(null)}>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteRecordId(record.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Attendance Record</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this attendance record for {record.full_name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAttendance(record.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AdminAttendanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchTeamAttendance}
        attendanceRecord={editingRecord}
        selectedDate={selectedDate}
      />
    </div>
  );
};

export default TeamAttendance;