import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const overtimeSchema = z.object({
  date: z.date({
    required_error: "Please select a date",
  }),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  reason: z.string().min(10, "Please provide a detailed reason (minimum 10 characters)"),
}).refine((data) => {
  const start = new Date(`2000-01-01T${data.startTime}`);
  const end = new Date(`2000-01-01T${data.endTime}`);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

type OvertimeFormData = z.infer<typeof overtimeSchema>;

interface OvertimeRequestFormProps {
  onSuccess?: () => void;
}

const OvertimeRequestForm = ({ onSuccess }: OvertimeRequestFormProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OvertimeFormData>({
    resolver: zodResolver(overtimeSchema),
    defaultValues: {
      startTime: "17:00",
      endTime: "20:00",
      reason: "",
    },
  });

  const calculateHours = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60);
  };

  const onSubmit = async (data: OvertimeFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const startDateTime = new Date(data.date);
      startDateTime.setHours(parseInt(data.startTime.split(':')[0]), parseInt(data.startTime.split(':')[1]));
      
      const endDateTime = new Date(data.date);
      endDateTime.setHours(parseInt(data.endTime.split(':')[0]), parseInt(data.endTime.split(':')[1]));

      const hours = calculateHours(data.startTime, data.endTime);

      const { error } = await supabase
        .from('overtime_requests')
        .insert({
          user_id: user.id,
          date: format(data.date, 'yyyy-MM-dd'),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          hours: hours,
          reason: data.reason,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Overtime request submitted successfully",
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting overtime request:', error);
      toast({
        title: "Error",
        description: "Failed to submit overtime request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedStartTime = form.watch("startTime");
  const watchedEndTime = form.watch("endTime");
  const estimatedHours = watchedStartTime && watchedEndTime 
    ? calculateHours(watchedStartTime, watchedEndTime) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Request Overtime
        </CardTitle>
        <CardDescription>
          Submit a request for overtime work approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date() || date < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {estimatedHours > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Estimated overtime hours: <span className="font-medium text-foreground">{estimatedHours.toFixed(1)} hours</span>
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Overtime</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please provide a detailed explanation for the overtime request..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default OvertimeRequestForm;