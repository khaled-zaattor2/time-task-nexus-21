import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const userFormSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  full_name: z.string().min(1, "Full name is required").max(100, "Name too long"),
  role: z.enum(["admin", "employee"], {
    required_error: "Role is required",
  }),
  base_salary: z.string().optional(),
  hourly_rate: z.string().optional(),
  vacation_days: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'employee';
  base_salary: number | null;
  hourly_rate: number | null;
  vacation_days: number | null;
  created_at: string;
  updated_at: string;
}

interface UserFormProps {
  user?: UserProfile;
  onSuccess: () => void;
}

const UserForm = ({ user, onSuccess }: UserFormProps) => {
  const [loading, setLoading] = useState(false);
  const isEditing = !!user;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: user?.email || "",
      full_name: user?.full_name || "",
      role: user?.role || "employee",
      base_salary: user?.base_salary?.toString() || "",
      hourly_rate: user?.hourly_rate?.toString() || "",
      vacation_days: user?.vacation_days?.toString() || "1",
      password: "",
    },
  });

  const onSubmit = async (values: UserFormValues) => {
    try {
      setLoading(true);

      if (isEditing) {
        // Update existing user
        const updateData: any = {
          full_name: values.full_name,
          role: values.role,
          base_salary: values.base_salary ? parseFloat(values.base_salary) : null,
          hourly_rate: values.hourly_rate ? parseFloat(values.hourly_rate) : null,
          vacation_days: values.vacation_days ? parseInt(values.vacation_days) : 1,
        };

        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user!.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "User updated successfully",
        });
      } else {
        // Create new user
        if (!values.password) {
          toast({
            title: "Error",
            description: "Password is required for new users",
            variant: "destructive",
          });
          return;
        }

        // Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: {
              full_name: values.full_name,
              role: values.role,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          // Update the profile with additional info
          const profileData = {
            user_id: authData.user.id,
            email: values.email,
            full_name: values.full_name,
            role: values.role,
            base_salary: values.base_salary ? parseFloat(values.base_salary) : null,
            hourly_rate: values.hourly_rate ? parseFloat(values.hourly_rate) : null,
            vacation_days: values.vacation_days ? parseInt(values.vacation_days) : 1,
          };

          const { error: profileError } = await supabase
            .from('profiles')
            .upsert(profileData);

          if (profileError) throw profileError;
        }

        toast({
          title: "Success",
          description: "User created successfully. They will receive an email to verify their account.",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  disabled={isEditing}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="base_salary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Salary (Annual)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="50000"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hourly_rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hourly Rate</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="25.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="vacation_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vacation Days</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="1"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isEditing && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Minimum 6 characters"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="submit"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update User" : "Create User"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default UserForm;