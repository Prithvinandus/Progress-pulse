-- Update the existing trigger to also calculate total_time_taken
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is being changed to 'Completed', set completion_time to NOW()
  IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    NEW.completion_time = NOW();
    NEW.total_time_taken = NEW.completion_time - NEW.created_at;
  -- If status is being changed from 'Completed' to something else, clear completion_time and total_time_taken
  ELSIF NEW.status != 'Completed' AND OLD.status = 'Completed' THEN
    NEW.completion_time = NULL;
    NEW.total_time_taken = NULL;
  END IF;
  
  -- Always update the updated_at timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;