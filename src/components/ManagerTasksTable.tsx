
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, Play } from 'lucide-react';
import { format } from 'date-fns';
import { formatDuration } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: number;
  user_id: string;
  task_description: string;
  status: string;
  created_at: string;
  updated_at: string;
  completion_time: unknown;
  total_time_taken: unknown;
  estimated_end_time: string | null;
}

interface TeamMember {
  user_id: string;
  display_name: string;
}

interface ManagerTasksTableProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  onTaskUpdated?: () => void;
}

const ManagerTasksTable = ({ tasks, teamMembers, onTaskUpdated }: ManagerTasksTableProps) => {
  const { toast } = useToast();

  const getStatusBadge = (status: string) => {
    const variants = {
      'Yet to Start': 'bg-gray-100 text-gray-800',
      'Started': 'bg-blue-100 text-blue-800',
      'WIP': 'bg-yellow-100 text-yellow-800',
      'Blocked': 'bg-red-100 text-red-800',
      'In Review': 'bg-purple-100 text-purple-800',
      'Completed': 'bg-green-100 text-green-800'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      'Yet to Start': <Clock className="w-4 h-4" />,
      'Started': <Play className="w-4 h-4" />,
      'WIP': <Clock className="w-4 h-4" />,
      'Blocked': <Clock className="w-4 h-4" />,
      'In Review': <Clock className="w-4 h-4" />,
      'Completed': <CheckCircle className="w-4 h-4" />
    };
    return icons[status as keyof typeof icons] || <Clock className="w-4 h-4" />;
  };

  const getUserDisplayName = (userId: string) => {
    const member = teamMembers.find(m => m.user_id === userId);
    return member ? member.display_name : userId.substring(0, 8) + '...';
  };

  const formatCompletionTime = (completionTime: unknown) => {
    if (!completionTime) return '-';
    if (typeof completionTime === 'string') {
      try {
        return format(new Date(completionTime), 'MMM d, yyyy h:mm a');
      } catch {
        return completionTime;
      }
    }
    return '-';
  };

  const formatEstimatedEndTime = (estimatedEndTime: string | null) => {
    if (!estimatedEndTime) return '-';
    try {
      return format(new Date(estimatedEndTime), 'MMM d, yyyy h:mm a');
    } catch {
      return estimatedEndTime;
    }
  };

  const handleUpdateTaskAssignment = async (taskId: number, newUserId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const newAssignee = teamMembers.find(m => m.user_id === newUserId);
      
      console.log(`Reassigning task ${taskId}: "${task?.task_description}" to ${newAssignee?.display_name || newUserId}`);

      const { error } = await supabase
        .from('tasks')
        .update({ user_id: newUserId })
        .eq('id', taskId);

      if (error) {
        console.error('Task reassignment error:', error.message, '- Code:', error.code);
        throw error;
      }

      console.log(`Task reassigned and notification sent to ${newAssignee?.display_name || newUserId}`);
      
      toast({
        title: "Success",
        description: "Task reassigned and notification sent",
      });
      onTaskUpdated?.();
    } catch (error: any) {
      console.error('Task reassignment error:', error?.message || error);
      toast({
        title: "Error",
        description: `Failed to update task assignment: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Badge className="mr-2">Manager</Badge>
          Tasks You've Assigned
        </CardTitle>
        <CardDescription>Overview of tasks assigned by you</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Estimated End Time</TableHead>
                <TableHead>Task Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead>Completion Time</TableHead>
                <TableHead>Total Time Taken</TableHead>
                <TableHead>Reassign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                    No tasks assigned yet
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      {getUserDisplayName(task.user_id)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatEstimatedEndTime(task.estimated_end_time)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {task.task_description}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(task.status)}>
                        <div className="flex items-center">
                          {getStatusIcon(task.status)}
                          <span className="ml-1">{task.status}</span>
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {format(new Date(task.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {format(new Date(task.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatCompletionTime(task.completion_time)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDuration(task.total_time_taken as string | null)}
                    </TableCell>
                    <TableCell>
                      {task.status !== 'Completed' && (
                        <Select
                          value={task.user_id}
                          onValueChange={(newUserId) => handleUpdateTaskAssignment(task.id, newUserId)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map((member) => (
                              <SelectItem key={member.user_id} value={member.user_id}>
                                {member.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManagerTasksTable;
