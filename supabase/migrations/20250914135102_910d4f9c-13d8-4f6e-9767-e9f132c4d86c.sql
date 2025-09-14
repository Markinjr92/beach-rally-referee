-- Create a function to reset all user passwords (for development purposes)
-- This will be used by the edge function to track password resets
CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reset_by UUID REFERENCES auth.users(id),
  reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT DEFAULT 'Admin password reset'
);

-- Enable RLS
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Only admins can manage password resets
CREATE POLICY "Admin can manage password resets"
ON public.password_resets
FOR ALL
USING (user_has_permission(auth.uid(), 'user.manage'));

-- Users can view their own password reset history
CREATE POLICY "Users can view own password resets"
ON public.password_resets
FOR SELECT
USING (auth.uid() = user_id);