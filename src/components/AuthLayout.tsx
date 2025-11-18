
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import Navigation from './Navigation';
import AuthForm from './AuthForm';
import { Loader2 } from 'lucide-react';

interface AuthLayoutProps {
  children: (user: User | null, session: Session | null) => React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} session={session} />
      <main className="pb-8">
        {children(user, session)}
      </main>
    </div>
  );
};

export default AuthLayout;
