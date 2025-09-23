import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: any | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    profile: null,
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        // Defer profile fetching with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setAuthState(prev => ({ ...prev, profile: null, loading: false }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      } else {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        toast({
          title: "Error",
          description: "Failed to load user profile",
          variant: "destructive",
        });
      }

      setAuthState(prev => ({
        ...prev,
        profile: data,
        loading: false,
      }));
    } catch (error) {
      console.error('Error fetching profile:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'employee' = 'employee') => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: role,
          }
        }
      });

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Success",
        description: "Account created successfully! Please check your email to verify your account.",
      });

      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast({
        title: "Sign Up Failed",
        description: err.message,
        variant: "destructive",
      });
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Success",
        description: "Signed in successfully!",
      });

      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast({
        title: "Sign In Failed",
        description: err.message,
        variant: "destructive",
      });
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({
          title: "Sign Out Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Success",
        description: "Signed out successfully!",
      });

      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast({
        title: "Sign Out Failed",
        description: err.message,
        variant: "destructive",
      });
      return { error: err };
    }
  };

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
    isAdmin: authState.profile?.role === 'admin',
    isEmployee: authState.profile?.role === 'employee',
  };
};