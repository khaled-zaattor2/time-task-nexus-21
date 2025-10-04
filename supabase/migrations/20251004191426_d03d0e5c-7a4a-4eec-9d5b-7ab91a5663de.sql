-- Drop the insecure profiles_public view and replace it with a secure function
-- Views cannot have RLS, so we'll use a security definer function instead

-- Drop the existing view if it exists
DROP VIEW IF EXISTS public.profiles_public;

-- Create a secure function that returns public profile data with proper access control
CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  role user_role
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Only return data if the user is authenticated
  SELECT 
    user_id,
    full_name,
    email,
    role
  FROM public.profiles
  WHERE auth.uid() IS NOT NULL;
$$;

-- Grant execute permission to authenticated users only
REVOKE ALL ON FUNCTION public.get_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated;

COMMENT ON FUNCTION public.get_public_profiles() IS 'Returns non-sensitive profile data for authenticated users only. Replaces the insecure profiles_public view.';