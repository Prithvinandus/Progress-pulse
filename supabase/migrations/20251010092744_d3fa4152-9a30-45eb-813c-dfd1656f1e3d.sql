-- Add estimated_end_time column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS estimated_end_time TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance on estimated_end_time
CREATE INDEX IF NOT EXISTS idx_tasks_estimated_end_time ON public.tasks(estimated_end_time);

-- No need to update status column as it's already a VARCHAR without constraints
-- The new statuses "Yet to Start", "Blocked", "In Review" can be used alongside existing ones