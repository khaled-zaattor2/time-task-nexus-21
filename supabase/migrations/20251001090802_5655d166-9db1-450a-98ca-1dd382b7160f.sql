-- Fix RLS policies on profiles table to properly restrict access
-- Drop existing SELECT policies that are incorrectly configured as RESTRICTIVE
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate SELECT policies as PERMISSIVE (default) so they work with OR logic
-- This ensures users can see their own profile OR admins can see all profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Add explicit column-level protection by creating a secure view for non-sensitive profile data
-- This view can be used by components that need to display user names without exposing salary data
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  user_id,
  full_name,
  email,
  role
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;

-- Add RLS to the view (views inherit the base table's RLS)
ALTER VIEW public.profiles_public SET (security_invoker = true);