
-- Update RLS policies to support manager role functionality

-- Allow managers to insert tasks (they can assign tasks to others)
CREATE POLICY "Managers can insert tasks" ON public.tasks
FOR INSERT
WITH CHECK (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'manager'
  OR 
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) LIKE '%manager%'
);

-- Allow managers to view tasks they have assigned
CREATE POLICY "Managers can view assigned tasks" ON public.tasks
FOR SELECT
USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'manager'
  OR 
  ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) LIKE '%manager%' AND assigned_by = auth.uid())
);

-- Allow admins to view all tasks (this should already exist but let's ensure it)
CREATE POLICY "Admin can view all tasks" ON public.tasks
FOR SELECT
USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
);
