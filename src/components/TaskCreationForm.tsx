
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TaskCreationFormProps {
  user: User | null;
  onTaskCreated: () => void;
}

interface TeamMember {
  user_id: string;
  display_name: string;
}

const TaskCreationForm = ({ user, onTaskCreated }: TaskCreationFormProps) => {
  const [taskDescription, setTaskDescription] = useState('');
  const [status, setStatus] = useState('Yet to Start');
  const [assignedTo, setAssignedTo] = useState('');
  const [estimatedEndTime, setEstimatedEndTime] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [filteredTeamMembers, setFilteredTeamMembers] = useState<TeamMember[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUserRole();
    fetchTeamMembers();
  }, []);

  const fetchUserRole = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return;
      }

      const role = data?.role || 'member';
      setUserRole(role);
      console.log(`Task creation allowed for role: ${role}`);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('member');
    }
  };

  const fetchTeamMembers = async () => {
    try {
      console.log('Fetching team members using get_team_members() function...');
      
      const { data, error } = await supabase.rpc('get_team_members');

      if (error) {
        console.error('Error fetching team members:', error);
        throw error;
      }

      console.log('Team members data:', data);
      setTeamMembers(data || []);
      console.log(`Team members loaded: ${data?.length || 0}`);
      
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Warning",
        description: "Could not load team members. Please try again.",
        variant: "destructive",
      });
      
      // Fallback: at least include current user if available
      if (user?.id) {
        const currentUserMember: TeamMember = {
          user_id: user.id,
          display_name: user.user_metadata?.name || 
                       user.user_metadata?.full_name || 
                       user.email || 
                       'Current User'
        };
        setTeamMembers([currentUserMember]);
      }
    }
  };

  useEffect(() => {
    if (teamMembers.length === 0 || !userRole) return;

    // Filter team members based on role
    if (userRole === 'member') {
      // Members can only assign to themselves
      const currentUserMember = teamMembers.find(m => m.user_id === user?.id);
      setFilteredTeamMembers(currentUserMember ? [currentUserMember] : []);
      // Auto-select current user for members
      if (currentUserMember && !assignedTo) {
        setAssignedTo(currentUserMember.user_id);
      }
    } else if (userRole.includes('manager') || userRole.includes('admin')) {
      // Managers and admins can assign to anyone
      setFilteredTeamMembers(teamMembers);
    } else {
      // Default: only allow self-assignment
      const currentUserMember = teamMembers.find(m => m.user_id === user?.id);
      setFilteredTeamMembers(currentUserMember ? [currentUserMember] : []);
    }
  }, [teamMembers, userRole, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDescription.trim() || !assignedTo || !estimatedEndTime) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate UUIDs
    if (!user?.id) {
      console.error('Task creation error: Manager user ID not available');
      toast({
        title: "Error",
        description: "User authentication error. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const assignedToMember = teamMembers.find(m => m.user_id === assignedTo);
      console.log(`Creating task: "${taskDescription.trim()}" with status "${status}" assigned to ${assignedToMember?.display_name || assignedTo}`);
      console.log(`Task details - user_id: ${assignedTo}, assigned_by: ${user?.id}, estimated_end_time: ${estimatedEndTime}`);

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          task_description: taskDescription.trim(),
          status,
          user_id: assignedTo,
          assigned_by: user?.id,
          estimated_end_time: estimatedEndTime,
        })
        .select();

      if (error) {
        console.error('Task creation error:', error.message, '- Code:', error.code, '- Details:', error.details);
        throw error;
      }

      console.log(`Task created successfully with ID: ${data?.[0]?.id}`);
      console.log(`Notification sent for task: ${taskDescription.trim()} to ${assignedToMember?.display_name || assignedTo}`);

      toast({
        title: "Success",
        description: "Task created and notification sent",
      });

      // Reset form
      setTaskDescription('');
      setStatus('Yet to Start');
      setAssignedTo('');
      setEstimatedEndTime('');
      onTaskCreated();
    } catch (error: any) {
      console.error('Task creation error:', error?.message || error);
      toast({
        title: "Error",
        description: `Failed to create task: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white p-6">
      <CardHeader>
        <CardTitle>Create New Task</CardTitle>
        <CardDescription>Assign a task to a team member</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="taskDescription">Task Description *</Label>
            <Textarea
              id="taskDescription"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Enter task description..."
              required
              className="w-full max-w-4xl"
            />
          </div>

          <div>
            <Label htmlFor="status">Status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
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

          <div>
            <Label htmlFor="assignedTo">Assigned To *</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={userRole === 'member'}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {filteredTeamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredTeamMembers.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Loading team members...
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="estimatedEndTime">Estimated End Time *</Label>
            <Input
              id="estimatedEndTime"
              type="datetime-local"
              value={estimatedEndTime}
              onChange={(e) => setEstimatedEndTime(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading || filteredTeamMembers.length === 0} className="w-full">
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TaskCreationForm;
