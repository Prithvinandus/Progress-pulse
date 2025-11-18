-- Update the send_task_notification function to use the correct project URL
CREATE OR REPLACE FUNCTION public.send_task_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignee_email TEXT;
  assignee_name TEXT;
  assigner_email TEXT;
  assigner_name TEXT;
  task_desc TEXT;
  status_text TEXT;
  estimated_end TEXT;
BEGIN
  -- Get assignee's email and name
  SELECT email, COALESCE(raw_user_meta_data->>'name', email)
  INTO assignee_email, assignee_name
  FROM auth.users WHERE id = NEW.user_id;

  -- Get assigner's email and name (assigned_by is the manager who created the task)
  SELECT email, COALESCE(raw_user_meta_data->>'name', email)
  INTO assigner_email, assigner_name
  FROM auth.users WHERE id = NEW.assigned_by;

  -- Get task description and other details
  task_desc := NEW.task_description;
  status_text := NEW.status;
  estimated_end := COALESCE(NEW.estimated_end_time::text, 'Not set');

  -- Call Edge Function
  PERFORM net.http_post(
    url := 'https://uxedmfrqxbgznmcvagon.supabase.co/functions/v1/send-task-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'assignee_email', assignee_email,
      'assignee_name', assignee_name,
      'assigner_email', assigner_email,
      'assigner_name', assigner_name,
      'task_desc', task_desc,
      'status', status_text,
      'estimated_end_time', estimated_end
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for new task insertions
DROP TRIGGER IF EXISTS task_notification_on_insert ON public.tasks;
CREATE TRIGGER task_notification_on_insert
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  WHEN (NEW.assigned_by IS NOT NULL)
  EXECUTE FUNCTION public.send_task_notification();

-- Create trigger for task reassignments (when user_id changes)
DROP TRIGGER IF EXISTS task_notification_on_reassign ON public.tasks;
CREATE TRIGGER task_notification_on_reassign
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id AND NEW.assigned_by IS NOT NULL)
  EXECUTE FUNCTION public.send_task_notification();
