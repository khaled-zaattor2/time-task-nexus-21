-- Add foreign key relationship between overtime_requests and profiles tables
-- This will allow proper joins when fetching overtime requests with user profile data

-- Add foreign key constraint for overtime_requests.user_id -> profiles.user_id  
ALTER TABLE public.overtime_requests 
ADD CONSTRAINT fk_overtime_requests_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;