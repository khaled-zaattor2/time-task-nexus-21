-- Add overtime ratio columns to company_settings table
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS overtime_first_period_hours numeric DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS overtime_first_period_ratio numeric DEFAULT 1.25,
ADD COLUMN IF NOT EXISTS overtime_second_period_ratio numeric DEFAULT 1.5;

-- Add comments to explain the columns
COMMENT ON COLUMN public.company_settings.overtime_first_period_hours IS 'First period duration in hours for overtime calculation';
COMMENT ON COLUMN public.company_settings.overtime_first_period_ratio IS 'Multiplier for first period of overtime (e.g., 1.25 = 125% of regular rate)';
COMMENT ON COLUMN public.company_settings.overtime_second_period_ratio IS 'Multiplier for second period of overtime (e.g., 1.5 = 150% of regular rate)';