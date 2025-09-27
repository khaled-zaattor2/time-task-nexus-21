import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Users, Clock, TrendingUp, TrendingDown } from "lucide-react";
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
          <Select
            value={format(selectedMonth, 'yyyy-MM')}
            onValueChange={(value) => {
              const [year, month] = value.split('-');
              setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
            }}
          >
            <SelectTrigger className="w-[180px]">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const value = format(date, 'yyyy-MM');
                const label = format(date, 'MMMM yyyy');
                return (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
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
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Working Days</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">Late</TableHead>
                <TableHead className="text-center">Total Hours</TableHead>
                <TableHead className="text-center">Attendance Rate</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No attendance data found for {format(selectedMonth, 'MMMM yyyy')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((employee) => (
                  <TableRow key={employee.user_id}>
                    <TableCell className="font-medium">{employee.employee_name}</TableCell>
                    <TableCell>{employee.employee_email}</TableCell>
                    <TableCell className="text-center">{employee.total_working_days}</TableCell>
                    <TableCell className="text-center">{employee.days_present}</TableCell>
                    <TableCell className="text-center">{employee.days_absent}</TableCell>
                    <TableCell className="text-center">{employee.days_late}</TableCell>
                    <TableCell className="text-center">{employee.total_hours.toFixed(1)}</TableCell>
                    <TableCell className="text-center">{employee.attendance_rate.toFixed(1)}%</TableCell>
                    <TableCell className="text-center">
                      {getAttendanceRateBadge(employee.attendance_rate)}
                    </TableCell>
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