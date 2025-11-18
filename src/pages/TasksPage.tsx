
import React from 'react';
import AuthLayout from '@/components/AuthLayout';
import TaskUpdatePage from '@/components/TaskUpdatePage';

const TasksPage = () => {
  return (
    <AuthLayout>
      {(user, session) => <TaskUpdatePage user={user} session={session} />}
    </AuthLayout>
  );
};

export default TasksPage;
