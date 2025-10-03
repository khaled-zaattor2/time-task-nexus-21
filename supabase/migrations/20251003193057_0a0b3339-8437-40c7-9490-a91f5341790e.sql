-- Drop the existing insecure view
DROP VIEW IF EXISTS public.profiles_public;

-- Create a secure view that only returns data to authenticated users
-- by adding a WHERE clause that checks for authentication
CREATE VIEW public.profiles_public
WITH (security_barrier = true, security_invoker = true)
AS
SELECT 
  user_id,
  full_name,
  email,
  role
FROM public.profiles
WHERE 
  -- Only return rows if the user is authenticated
  auth.uid() IS NOT NULL
  AND (
    -- Users can see their own profile
    auth.uid() = user_id 
    OR 
    -- Admins can see all profiles
    get_user_role(auth.uid()) = 'admin'::user_role
  );

-- Add comment explaining the security model
COMMENT ON VIEW public.profiles_public IS 'Secure view of user profiles exposing only non-sensitive data (name, email, role). Only accessible to authenticated users. Users can see their own profile, admins can see all.';