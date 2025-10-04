import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Project {
  id: string;
  name: string;
}

interface User {
  user_id: string;
  full_name: string;
}

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
}

interface TaskFormProps {
  task?: Task | null;
  assignmentMode?: 'admin_assign' | 'self_assign';
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TaskForm({ task, assignmentMode = 'admin_assign', onSuccess, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    project_id: "",
    assigned_to: "",
    status: "pending" as 'pending' | 'in_progress' | 'completed',
    estimated_hours: "",
    actual_hours: "",
    due_date: "",
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load projects and users
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load projects
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name')
          .eq('status', 'active')
          .order('name');

        if (projectsError) throw projectsError;
        setProjects(projectsData || []);

        // Load users - use secure function which only exposes non-sensitive data
        const { data: usersData, error: usersError } = await supabase
          .rpc('get_public_profiles');

        if (usersError) throw usersError;
        setUsers(usersData || []);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load projects and users",
          variant: "destructive",
        });
      }
    };

    loadData();
  }, [toast]);

  // Populate form when editing or set self-assignment
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        project_id: task.project_id,
        assigned_to: task.assigned_to,
        status: task.status,
        estimated_hours: task.estimated_hours?.toString() || "",
        actual_hours: task.actual_hours?.toString() || "",
        due_date: task.due_date || "",
      });
    } else if (assignmentMode === 'self_assign' && user) {
      // Pre-populate assigned_to with current user for self-assignment
      setFormData(prev => ({
        ...prev,
        assigned_to: user.id,
      }));
    }
  }, [task, assignmentMode, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const taskData = {
        title: formData.title,
        description: formData.description || null,
        project_id: formData.project_id,
        assigned_to: formData.assigned_to,
        status: formData.status,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        actual_hours: formData.actual_hours ? parseFloat(formData.actual_hours) : null,
        due_date: formData.due_date || null,
        created_by: user.id,
      };

      if (task) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', task.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Task updated successfully",
        });
      } else {
        // Create new task
        const { error } = await supabase
          .from('tasks')
          .insert([taskData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Task created successfully",
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: "Error",
        description: `Failed to ${task ? 'update' : 'create'} task`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="title">Task Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Enter task title"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Enter task description"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="project_id">Project *</Label>
            <Select value={formData.project_id} onValueChange={(value) => handleInputChange('project_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="assigned_to">Assigned To *</Label>
            <Select 
              value={formData.assigned_to} 
              onValueChange={(value) => handleInputChange('assigned_to', value)}
              disabled={assignmentMode === 'self_assign'}
            >
              <SelectTrigger>
                <SelectValue placeholder={assignmentMode === 'self_assign' ? "Assigned to yourself" : "Select user"} />
              </SelectTrigger>
              <SelectContent>
                {assignmentMode === 'self_assign' ? (
                  // Show only current user for self-assignment
                  users
                    .filter(u => u.user_id === user?.id)
                    .map((userItem) => (
                      <SelectItem key={userItem.user_id} value={userItem.user_id}>
                        {userItem.full_name}
                      </SelectItem>
                    ))
                ) : (
                  // Show all users for admin assignment
                  users.map((userItem) => (
                    <SelectItem key={userItem.user_id} value={userItem.user_id}>
                      {userItem.full_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="estimated_hours">Estimated Hours</Label>
            <Input
              id="estimated_hours"
              type="number"
              step="0.5"
              min="0"
              value={formData.estimated_hours}
              onChange={(e) => handleInputChange('estimated_hours', e.target.value)}
              placeholder="0.0"
            />
          </div>

          <div>
            <Label htmlFor="actual_hours">Actual Hours</Label>
            <Input
              id="actual_hours"
              type="number"
              step="0.5"
              min="0"
              value={formData.actual_hours}
              onChange={(e) => handleInputChange('actual_hours', e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="due_date">Due Date</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date}
            onChange={(e) => handleInputChange('due_date', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !formData.title || !formData.project_id || !formData.assigned_to}>
          {loading ? "Saving..." : task ? "Update Task" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}