-- Add pay cut tracking columns to attendance table
ALTER TABLE public.attendance
ADD COLUMN late_minutes numeric DEFAULT 0,
ADD COLUMN early_departure_minutes numeric DEFAULT 0,
ADD COLUMN pay_cut_amount numeric DEFAULT 0,
ADD COLUMN pay_cut_approved boolean DEFAULT false,
ADD COLUMN pay_cut_approved_by uuid REFERENCES auth.users(id),
ADD COLUMN pay_cut_approved_at timestamp with time zone;

-- Add comment explaining the pay cut calculation
COMMENT ON COLUMN public.attendance.pay_cut_amount IS 'Calculated pay cut: first 60 mins at 1x ratio, after 60 mins at 1.5x ratio';

-- Create function to calculate pay cut based on tiered ratios
CREATE OR REPLACE FUNCTION public.calculate_pay_cut(
  p_late_minutes numeric,
  p_early_departure_minutes numeric,
  p_hourly_rate numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_minutes numeric;
  first_period_minutes numeric;
  second_period_minutes numeric;
  pay_cut numeric;
BEGIN
  -- Total violation minutes
  total_minutes := COALESCE(p_late_minutes, 0) + COALESCE(p_early_departure_minutes, 0);
  
  -- If no hourly rate, return 0
  IF p_hourly_rate IS NULL OR p_hourly_rate = 0 THEN
    RETURN 0;
  END IF;
  
  -- Calculate first period (up to 60 minutes at 1x ratio)
  IF total_minutes <= 60 THEN
    first_period_minutes := total_minutes;
    second_period_minutes := 0;
  ELSE
    first_period_minutes := 60;
    second_period_minutes := total_minutes - 60;
  END IF;
  
  -- Calculate pay cut
  -- First period: minutes * (hourly_rate / 60) * 1.0
  -- Second period: minutes * (hourly_rate / 60) * 1.5
  pay_cut := (first_period_minutes * (p_hourly_rate / 60) * 1.0) +
             (second_period_minutes * (p_hourly_rate / 60) * 1.5);
  
  RETURN ROUND(pay_cut, 2);
END;
$$;