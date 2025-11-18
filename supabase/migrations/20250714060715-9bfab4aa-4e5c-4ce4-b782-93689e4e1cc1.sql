-- Fix completion_time column to allow manual updates
-- Remove any constraints that prevent manual updates to completion_time
ALTER TABLE public.tasks ALTER COLUMN completion_time DROP DEFAULT;

-- Add a trigger to automatically set completion_time when status is 'Completed'
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is being changed to 'Completed', set completion_time to NOW()
  IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    NEW.completion_time = NOW();
  -- If status is being changed from 'Completed' to something else, clear completion_time
  ELSIF NEW.status != 'Completed' AND OLD.status = 'Completed' THEN
    NEW.completion_time = NULL;
  END IF;
  
  -- Always update the updated_at timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_handle_task_completion ON public.tasks;
CREATE TRIGGER trigger_handle_task_completion
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_completion();