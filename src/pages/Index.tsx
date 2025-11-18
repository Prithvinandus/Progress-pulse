
import React from 'react';
import AuthLayout from '@/components/AuthLayout';
import HomePage from '@/components/HomePage';

const Index = () => {
  return (
    <AuthLayout>
      {(user, session) => <HomePage user={user} session={session} />}
    </AuthLayout>
  );
};

export default Index;
