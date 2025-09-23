-- Create custom types
CREATE TYPE public.user_role AS ENUM ('admin', 'employee');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late');
CREATE TYPE public.overtime_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'on_hold');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  base_salary DECIMAL(10,2),
  hourly_rate DECIMAL(8,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'pending',
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  due_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  total_hours DECIMAL(4,2),
  regular_hours DECIMAL(4,2),
  overtime_hours DECIMAL(4,2),
  status attendance_status NOT NULL DEFAULT 'present',
  is_late BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create overtime_requests table
CREATE TABLE public.overtime_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  hours DECIMAL(4,2) NOT NULL,
  reason TEXT,
  status overtime_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create settings table
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  working_days JSONB NOT NULL DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday"]',
  daily_working_hours DECIMAL(4,2) NOT NULL DEFAULT 8.0,
  break_time_minutes INTEGER NOT NULL DEFAULT 60,
  overtime_threshold DECIMAL(4,2) NOT NULL DEFAULT 8.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.company_settings (working_days, daily_working_hours, break_time_minutes, overtime_threshold)
VALUES ('["monday", "tuesday", "wednesday", "thursday", "friday"]', 8.0, 60, 8.0);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE profiles.user_id = $1;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for projects
CREATE POLICY "Everyone can view projects"
ON public.projects FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage projects"
ON public.projects FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for tasks
CREATE POLICY "Users can view their assigned tasks"
ON public.tasks FOR SELECT
USING (auth.uid() = assigned_to OR public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can update their assigned tasks"
ON public.tasks FOR UPDATE
USING (auth.uid() = assigned_to OR public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage all tasks"
ON public.tasks FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for attendance
CREATE POLICY "Users can view their own attendance"
ON public.attendance FOR SELECT
USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can insert their own attendance"
ON public.attendance FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance"
ON public.attendance FOR UPDATE
USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage all attendance"
ON public.attendance FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for overtime requests
CREATE POLICY "Users can view their own overtime requests"
ON public.overtime_requests FOR SELECT
USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can create their own overtime requests"
ON public.overtime_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending overtime requests"
ON public.overtime_requests FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all overtime requests"
ON public.overtime_requests FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for company settings
CREATE POLICY "Everyone can view company settings"
ON public.company_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can manage company settings"
ON public.company_settings FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_overtime_requests_updated_at
  BEFORE UPDATE ON public.overtime_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();