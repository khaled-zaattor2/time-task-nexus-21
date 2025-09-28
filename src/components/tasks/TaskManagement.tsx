import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Edit, Trash2, Calendar, CheckCircle, Clock, AlertCircle, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import TaskForm from "./TaskForm";

interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'completed';
  estimated_hours: number | null;
  actual_hours: number | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
  assigned_to_name?: string;
  created_by_name?: string;
}

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'admin_assign' | 'self_assign'>('admin_assign');
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user is admin
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

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Get project names, assigned user names, and creator names
      const tasksWithDetails = await Promise.all(
        (tasksData || []).map(async (task) => {
          // Get project name
          const { data: projectData } = await supabase
            .from('projects')
            .select('name')
            .eq('id', task.project_id)
            .single();

          // Get assigned user name
          const { data: assignedUserData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', task.assigned_to)
            .single();

          // Get creator name
          const { data: creatorData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', task.created_by)
            .single();

          return {
            ...task,
            project_name: projectData?.name || 'Unknown Project',
            assigned_to_name: assignedUserData?.full_name || 'Unknown User',
            created_by_name: creatorData?.full_name || 'Unknown User',
          };
        })
      );

      setTasks(tasksWithDetails);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedTask(null);
    fetchTasks();
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (task.project_name && task.project_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: Task['status']) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, color: "text-yellow-600", icon: Clock },
      in_progress: { variant: "default" as const, color: "text-blue-600", icon: AlertCircle },
      completed: { variant: "default" as const, color: "text-green-600", icon: CheckCircle },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading tasks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Task Management</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage and track project tasks" : "View your assigned tasks"}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setSelectedTask(null);
                  setAssignmentMode('admin_assign');
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Task to Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTask ? 'Edit Task' : 'Assign Task to Employee'}
                  </DialogTitle>
                </DialogHeader>
                <TaskForm
                  task={selectedTask}
                  assignmentMode={assignmentMode}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setIsFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
          {!isAdmin && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setSelectedTask(null);
                  setAssignmentMode('self_assign');
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task for Myself
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Task for Myself</DialogTitle>
                </DialogHeader>
                <TaskForm
                  task={selectedTask}
                  assignmentMode={assignmentMode}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setIsFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Task Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{taskStats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{taskStats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{taskStats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            View and manage all tasks across projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground max-w-xs truncate">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{task.project_name}</TableCell>
                      <TableCell>{task.assigned_to_name}</TableCell>
                      <TableCell>
                        {getStatusBadge(task.status)}
                      </TableCell>
                      <TableCell>
                        {task.due_date 
                          ? format(new Date(task.due_date), 'MMM dd, yyyy')
                          : 'No due date'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Est: {task.estimated_hours || '-'}h</div>
                          <div>Act: {task.actual_hours || '-'}h</div>
                        </div>
                      </TableCell>
                      <TableCell>{task.created_by_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setAssignmentMode('admin_assign');
                                  setIsFormOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Task</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{task.title}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          {!isAdmin && <span className="text-sm text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}