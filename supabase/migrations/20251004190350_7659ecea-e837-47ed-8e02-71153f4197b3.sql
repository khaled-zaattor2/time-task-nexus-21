-- Add vacation_days column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS vacation_days integer DEFAULT 1;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.vacation_days IS 'Number of days the user can be absent without pay cut';