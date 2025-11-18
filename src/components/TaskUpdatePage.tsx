
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Clock, Play, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatDuration } from '@/lib/utils';

interface TaskUpdatePageProps {
  user: User | null;
  session: Session | null;
}

interface Task {
  id: number;
  user_id: string;
  task_description: string;
  status: string;
  created_at: string;
  updated_at: string;
  completion_time: string | null;
  total_time_taken: string | null;
  assigned_by: string | null;
  estimated_end_time: string | null;
}

interface TeamMember {
  user_id: string;
  display_name: string;
}

const TaskUpdatePage = ({ user, session }: TaskUpdatePageProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchTeamMembers();
      fetchTasks();
      setupRealtimeSubscription();
    }
  }, [user]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_team_members');
      if (error) {
        console.log(`User name query error: ${error.message}`);
        throw error;
      }
      console.log(`User names fetched: [${(data || []).map(m => m.display_name).join(', ')}]`);
      setTeamMembers(data || []);
    } catch (error) {
      console.log(`Error fetching team members: ${error}`);
    }
  };

  const getUserDisplayName = (userId: string) => {
    const member = teamMembers.find(m => m.user_id === userId);
    return member ? member.display_name : userId.substring(0, 8) + '...';
  };

  const fetchTasks = async () => {
    try {
      console.log(`Fetching member tasks for user ID: ${user?.id}`);
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.log(`Member tasks query error: ${error.message}`);
        throw error;
      }
      
      console.log(`Tasks fetched: ${(data || []).length} rows`);
      const typedTasks = (data || []).map(task => ({
        ...task,
        completion_time: task.completion_time as string | null,
        total_time_taken: task.total_time_taken as string | null
      }));
      setTasks(typedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to fetch tasks');
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('user-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!taskDescription.trim() || !taskStatus) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          user_id: user?.id,
          task_description: taskDescription.trim(),
          status: taskStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setMessage('Task submitted successfully!');
      setTaskDescription('');
      setTaskStatus('');
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.log(`Task creation error: ${error.message}`);
      setError(error.message || 'Failed to submit task');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    setUpdating(taskId);
    setError('');
    
    console.log(`Updating task ID: ${taskId} to status: ${newStatus}`);

    try {
      // Only update status - the database trigger will handle completion_time and updated_at
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
        .eq('user_id', user?.id);

      if (error) {
        console.log(`Task update error: ${error.message}`);
        if (error.message.includes('permission')) {
          throw new Error('Permission denied: You can only update your own tasks');
        } else {
          throw error;
        }
      }

      if (newStatus === 'Completed') {
        console.log(`Task marked as completed - completion time and total time taken set automatically`);
      } else {
        console.log(`Task status updated to: ${newStatus} - completion time and total time taken cleared`);
      }

      setMessage('Task status updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.log(`Task update error: ${error.message}`);
      setError(error.message || 'Failed to update task status');
    } finally {
      setUpdating(null);
    }
  };

  const formatEstimatedEndTime = (estimatedEndTime: string | null) => {
    if (!estimatedEndTime) return '-';
    try {
      return format(new Date(estimatedEndTime), 'MMM d, yyyy h:mm a');
    } catch {
      return estimatedEndTime;
    }
  };

  const formatCompletionTime = (completionTime: string | null) => {
    if (!completionTime) return '-';
    try {
      return format(new Date(completionTime), 'MMM d, yyyy h:mm a');
    } catch {
      return completionTime;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Task Management</h1>
        <p className="text-gray-600">Submit new tasks and update existing ones</p>
      </div>

      {/* New Task Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Submit New Task</CardTitle>
          <CardDescription>Add a new task to your daily standup</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitTask} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="task-description">Task Description *</Label>
              <Textarea
                id="task-description"
                placeholder="Describe what you're working on..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                disabled={loading}
                className="min-h-20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-status">Status *</Label>
              <Select value={taskStatus} onValueChange={setTaskStatus} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yet to Start">Yet to Start</SelectItem>
                  <SelectItem value="Started">Started</SelectItem>
                  <SelectItem value="WIP">WIP</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                  <SelectItem value="In Review">In Review</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading || !taskDescription.trim() || !taskStatus}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Task
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Messages */}
      {message && (
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Your Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Tasks</CardTitle>
          <CardDescription>
            View and update your existing tasks. Task descriptions cannot be modified after submission.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No tasks found. Submit your first task above!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Name</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead>Estimated End Time</TableHead>
                    <TableHead>Task Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead>Completion Time</TableHead>
                    <TableHead>Total Time Taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        {getUserDisplayName(task.user_id)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {task.assigned_by ? getUserDisplayName(task.assigned_by) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatEstimatedEndTime(task.estimated_end_time)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="p-2 bg-gray-50 rounded border text-sm">
                          {task.task_description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(newStatus) => handleUpdateTaskStatus(task.id, newStatus)}
                          disabled={updating === task.id}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yet to Start">Yet to Start</SelectItem>
                            <SelectItem value="Started">Started</SelectItem>
                            <SelectItem value="WIP">WIP</SelectItem>
                            <SelectItem value="Blocked">Blocked</SelectItem>
                            <SelectItem value="In Review">In Review</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(task.created_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(task.updated_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatCompletionTime(task.completion_time)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDuration(task.total_time_taken)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskUpdatePage;
