import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Users, Clock, TrendingUp, TrendingDown, Settings, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";

interface MonthlyAttendanceData {
  employee_name: string;
  employee_email: string;
  user_id: string;
  total_working_days: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  total_hours: number;
  attendance_rate: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [attendanceData, setAttendanceData] = useState<MonthlyAttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    employee_name: true,
    employee_email: true,
    total_working_days: true,
    days_present: true,
    days_absent: true,
    days_late: true,
    total_hours: true,
    attendance_rate: true,
    status: true
  });

  // Column definitions
  const columns = [
    { key: 'employee_name', label: 'Employee', required: true },
    { key: 'employee_email', label: 'Email' },
    { key: 'total_working_days', label: 'Working Days' },
    { key: 'days_present', label: 'Present' },
    { key: 'days_absent', label: 'Absent' },
    { key: 'days_late', label: 'Late' },
    { key: 'total_hours', label: 'Total Hours' },
    { key: 'attendance_rate', label: 'Attendance Rate' },
    { key: 'status', label: 'Status' }
  ];

  const toggleColumnVisibility = (columnKey: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey as keyof typeof prev]
    }));
  };

  useEffect(() => {
    if (user) {
      checkUserRole();
    }
  }, [user]);

  useEffect(() => {
    fetchMonthlyAttendanceData();
  }, [selectedMonth]);

  const checkUserRole = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user?.id)
        .single();

      if (profile?.role !== 'admin') {
        setLoading(false);
        return;
      }

      fetchMonthlyAttendanceData();
    } catch (error) {
      console.error('Error checking user role:', error);
      setLoading(false);
    }
  };

  const fetchMonthlyAttendanceData = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      // Get all employees
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      if (!profiles) {
        setAttendanceData([]);
        setLoading(false);
        return;
      }

      // Get attendance data for the month
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      // Calculate working days in the month (excluding weekends)
      const workingDaysInMonth = eachDayOfInterval({
        start: monthStart,
        end: monthEnd
      }).filter(day => !isWeekend(day)).length;

      // Process data for each employee
      const processedData = profiles.map(profile => {
        const userAttendance = attendanceRecords?.filter(
          record => record.user_id === profile.user_id
        ) || [];

        const daysPresent = userAttendance.filter(
          record => record.status === 'present'
        ).length;

        const daysLate = userAttendance.filter(
          record => record.is_late === true
        ).length;

        const totalHours = userAttendance.reduce(
          (sum, record) => sum + (Number(record.total_hours) || 0), 0
        );

        const attendanceRate = workingDaysInMonth > 0 
          ? (daysPresent / workingDaysInMonth) * 100 
          : 0;

        return {
          employee_name: profile.full_name,
          employee_email: profile.email,
          user_id: profile.user_id,
          total_working_days: workingDaysInMonth,
          days_present: daysPresent,
          days_absent: workingDaysInMonth - daysPresent,
          days_late: daysLate,
          total_hours: totalHours,
          attendance_rate: attendanceRate,
        };
      });

      setAttendanceData(processedData);
    } catch (error) {
      console.error('Error fetching monthly attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setIsAdmin(profile?.role === 'admin');
    };
    
    checkAdmin();
  }, [user]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 p-6">
            <Users className="h-16 w-16 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Access Denied</h3>
              <p className="text-muted-foreground">
                You need administrator privileges to view the dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredData = attendanceData.filter(employee =>
    employee.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employee_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary statistics
  const totalEmployees = attendanceData.length;
  const avgAttendanceRate = attendanceData.length > 0 
    ? attendanceData.reduce((sum, emp) => sum + emp.attendance_rate, 0) / attendanceData.length
    : 0;
  const totalHoursWorked = attendanceData.reduce((sum, emp) => sum + emp.total_hours, 0);
  const totalAbsentDays = attendanceData.reduce((sum, emp) => sum + emp.days_absent, 0);

  const getAttendanceRateBadge = (rate: number) => {
    if (rate >= 95) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (rate >= 85) return <Badge className="bg-blue-100 text-blue-800">Good</Badge>;
    if (rate >= 70) return <Badge className="bg-yellow-100 text-yellow-800">Average</Badge>;
    return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Monthly attendance overview for all employees</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Month Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedMonth, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => {
                  if (date) {
                    setSelectedMonth(date);
                  }
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          <Button onClick={fetchMonthlyAttendanceData} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAttendanceRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Monthly average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursWorked.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Hours worked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Absent Days</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAbsentDays}</div>
            <p className="text-xs text-muted-foreground">Days absent</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Report Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Monthly Attendance Report - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
            <div className="flex items-center space-x-4">
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              
              {/* Column Visibility Control */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="end">
                  <div className="space-y-3">
                    <div className="font-medium text-sm">Show/Hide Columns</div>
                    {columns.map((column) => (
                      <div key={column.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={column.key}
                          checked={visibleColumns[column.key as keyof typeof visibleColumns]}
                          onCheckedChange={() => toggleColumnVisibility(column.key)}
                          disabled={column.required}
                        />
                        <label
                          htmlFor={column.key}
                          className={cn(
                            "text-sm font-normal cursor-pointer",
                            column.required && "text-muted-foreground"
                          )}
                        >
                          {column.label}
                          {column.required && " (Required)"}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.employee_name && <TableHead>Employee</TableHead>}
                {visibleColumns.employee_email && <TableHead>Email</TableHead>}
                {visibleColumns.total_working_days && <TableHead className="text-center">Working Days</TableHead>}
                {visibleColumns.days_present && <TableHead className="text-center">Present</TableHead>}
                {visibleColumns.days_absent && <TableHead className="text-center">Absent</TableHead>}
                {visibleColumns.days_late && <TableHead className="text-center">Late</TableHead>}
                {visibleColumns.total_hours && <TableHead className="text-center">Total Hours</TableHead>}
                {visibleColumns.attendance_rate && <TableHead className="text-center">Attendance Rate</TableHead>}
                {visibleColumns.status && <TableHead className="text-center">Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={Object.values(visibleColumns).filter(Boolean).length} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    No attendance data found for {format(selectedMonth, 'MMMM yyyy')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((employee) => (
                  <TableRow key={employee.user_id}>
                    {visibleColumns.employee_name && (
                      <TableCell className="font-medium">{employee.employee_name}</TableCell>
                    )}
                    {visibleColumns.employee_email && (
                      <TableCell>{employee.employee_email}</TableCell>
                    )}
                    {visibleColumns.total_working_days && (
                      <TableCell className="text-center">{employee.total_working_days}</TableCell>
                    )}
                    {visibleColumns.days_present && (
                      <TableCell className="text-center">{employee.days_present}</TableCell>
                    )}
                    {visibleColumns.days_absent && (
                      <TableCell className="text-center">{employee.days_absent}</TableCell>
                    )}
                    {visibleColumns.days_late && (
                      <TableCell className="text-center">{employee.days_late}</TableCell>
                    )}
                    {visibleColumns.total_hours && (
                      <TableCell className="text-center">{employee.total_hours.toFixed(1)}</TableCell>
                    )}
                    {visibleColumns.attendance_rate && (
                      <TableCell className="text-center">{employee.attendance_rate.toFixed(1)}%</TableCell>
                    )}
                    {visibleColumns.status && (
                      <TableCell className="text-center">
                        {getAttendanceRateBadge(employee.attendance_rate)}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;