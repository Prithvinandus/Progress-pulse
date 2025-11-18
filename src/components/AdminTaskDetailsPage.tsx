
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, Clock, Play } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { formatDuration } from '@/lib/utils';

interface AdminTaskDetailsPageProps {
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
  completion_time: unknown;
  total_time_taken: unknown;
  assigned_by: string | null;
  estimated_end_time: string | null;
}

interface TeamMember {
  user_id: string;
  display_name: string;
}

const AdminTaskDetailsPage = ({ user, session }: AdminTaskDetailsPageProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');

  useEffect(() => {
    document.title = 'Task Details - Admin';
  }, []);

  useEffect(() => {
    // Initialize filters from URL
    const status = searchParams.get('status') || 'all';
    const userParam = searchParams.get('user') || 'all';
    setStatusFilter(status);
    setUserFilter(userParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch team members
        const { data: members, error: membersError } = await supabase.rpc('get_team_members');
        if (membersError) {
          console.log(`User name filter query error: ${membersError.message}`);
        }
        setTeamMembers(members || []);

        console.log('Fetching admin task details...');
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log(`Tasks fetched: ${(data || []).length} rows`);
        setTasks(data || []);
      } catch (e: any) {
        console.log(`Permission denied for tasks or fetch error: ${e.message || e}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    const next = new URLSearchParams(searchParams);
    next.set('status', val);
    setSearchParams(next, { replace: true });
  };

  const handleUserChange = (val: string) => {
    setUserFilter(val);
    const next = new URLSearchParams(searchParams);
    next.set('user', val);
    setSearchParams(next, { replace: true });
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

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (userFilter !== 'all') {
      const member = teamMembers.find(m => m.display_name === userFilter);
      if (member) filtered = filtered.filter(t => t.user_id === member.user_id);
    }
    return filtered;
  }, [tasks, statusFilter, userFilter, teamMembers]);

  const exportToExcel = () => {
    try {
      const exportData = filteredTasks.map(task => ({
        'User Name': getUserDisplayName(task.user_id),
        'Assigned By': task.assigned_by ? getUserDisplayName(task.assigned_by) : '-',
        'Estimated End Time': formatEstimatedEndTime(task.estimated_end_time),
        'Task Description': task.task_description,
        'Status': task.status,
        'Created At': format(new Date(task.created_at), 'MMM d, yyyy h:mm a'),
        'Updated At': format(new Date(task.updated_at), 'MMM d, yyyy h:mm a'),
        'Completion Time': formatCompletionTime(task.completion_time),
        'Total Time Taken': formatDuration(task.total_time_taken as string | null),
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
      XLSX.writeFile(wb, `tasks-details-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      console.log(`Tasks exported: ${exportData.length} rows`);
    } catch (e) {
      console.log(`Export error: ${e}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Task Details</h1>
        <p className="text-muted-foreground">Detailed task data for administrators</p>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="yet to start">Yet to Start</SelectItem>
            <SelectItem value="started">Started</SelectItem>
            <SelectItem value="wip">WIP</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="in review">In Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={handleUserChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by user" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {teamMembers.map((member) => (
              <SelectItem key={member.user_id} value={member.display_name}>
                {member.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={exportToExcel} variant="outline" className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </Button>

        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link to={`/?status=${statusFilter}&user=${userFilter}`}>Back to Summary</Link>
        </Button>
      </div>

      {/* Detailed Tasks Table */}
      <div className="overflow-x-auto">
        <Table className="w-full border border-gray-300 text-center">
          <TableHeader>
            <TableRow className="bg-gray-200 text-center">
              <TableHead className="border border-gray-300 font-bold text-center">User Name</TableHead>
              <TableHead className="border border-gray-300 font-bold text-center">Assigned By</TableHead>
              <TableHead className="border border-gray-300 font-bold text-center">Estimated End Time</TableHead>
              <TableHead className="border border-gray-300 font-bold text-center">Task Description</TableHead>
              <TableHead className="border border-gray-300 font-bold text-center">Status</TableHead>
              <TableHead className="border border-gray-300 font-bold text-center">Created At</TableHead>
              <TableHead className="border border-gray-300 font-bold text-center">Updated At</TableHead>
              <TableHead className="border border-gray-300 font-bold text-center">Completion Time</TableHead>
              <TableHead className="border border-gray-300 font-bold text-center">Total Time Taken</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow key={task.id} className="odd:bg-white even:bg-gray-100 hover:bg-gray-50">
                <TableCell className="font-bold border border-gray-300 text-center">{getUserDisplayName(task.user_id)}</TableCell>
                <TableCell className="font-bold border border-gray-300 text-center">
                  {task.assigned_by ? getUserDisplayName(task.assigned_by) : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground border border-gray-300 text-center">
                  {formatEstimatedEndTime(task.estimated_end_time)}
                </TableCell>
                <TableCell className="max-w-xs truncate border border-gray-300 text-center">{task.task_description}</TableCell>
                <TableCell className="border border-gray-300 text-center">
                  <Badge>
                    <div className="flex items-center justify-center">
                      {task.status === 'Yet to Start' && <Clock className="w-4 h-4" />}
                      {task.status === 'Started' && <Play className="w-4 h-4" />}
                      {task.status === 'WIP' && <Clock className="w-4 h-4" />}
                      {task.status === 'Blocked' && <Clock className="w-4 h-4" />}
                      {task.status === 'In Review' && <Clock className="w-4 h-4" />}
                      {task.status === 'Completed' && <CheckCircle className="w-4 h-4" />}
                      <span className="ml-1">{task.status}</span>
                    </div>
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground border border-gray-300 text-center">
                  {format(new Date(task.created_at), 'MMM d, yyyy h:mm a')}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground border border-gray-300 text-center">
                  {format(new Date(task.updated_at), 'MMM d, yyyy h:mm a')}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground border border-gray-300 text-center">
                  {formatCompletionTime(task.completion_time)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground border border-gray-300 text-center">
                  {formatDuration(task.total_time_taken as string | null)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminTaskDetailsPage;
