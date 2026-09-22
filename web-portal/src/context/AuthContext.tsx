'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

export type UserRole = 'customer' | 'artisan' | 'admin' | 'super_admin';

export interface UserProfile {
  id: string;
  role: UserRole | null;
  full_name: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  state?: string | null;
  preferred_language?: string | null;
  craft_category?: string | null;
  onboarding_completed?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  profile: UserProfile | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isArtisan: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, extraMeta?: Record<string, any>) => Promise<{ error: Error | null }>;
  completeOnboarding: (details: {
    role: UserRole;
    fullName: string;
    phone: string;
    state?: string;
    craft_category?: string;
    preferred_language?: string;
    interest?: string;
  }) => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = useCallback(async (userId: string, authUser: User): Promise<{ role: UserRole | null; profile: UserProfile; needsOnboarding: boolean }> => {
    // Browser state is presentation-only. Roles are read exclusively from
    // signed Supabase app_metadata; the API verifies them again server-side.
    const appMetadataRole = authUser.app_metadata?.role;
    const resolvedRole: UserRole = ['customer', 'artisan', 'admin', 'super_admin'].includes(appMetadataRole)
      ? appMetadataRole as UserRole
      : 'customer';

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, avatar_url, phone, state, preferred_language, craft_category, onboarding_completed')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const needsOnboarding = data.onboarding_completed !== true;

        return {
          role: resolvedRole,
          needsOnboarding,
          profile: {
            id: data.id,
            role: resolvedRole,
            full_name: data.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Hunardhara Member',
            avatar_url: data.avatar_url || authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
            phone: data.phone || authUser.user_metadata?.phone,
            state: data.state || authUser.user_metadata?.state,
            preferred_language: data.preferred_language || authUser.user_metadata?.preferred_language,
            craft_category: data.craft_category || authUser.user_metadata?.craft_category,
            onboarding_completed: !needsOnboarding,
          },
        };
      }
    } catch {
      // Fallback
    }

    const needsOnboarding = authUser.user_metadata?.onboarding_completed !== true;

    return {
      role: resolvedRole,
      needsOnboarding,
      profile: {
        id: userId,
        role: resolvedRole,
        full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Hunardhara Member',
        avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
        phone: authUser.user_metadata?.phone,
        state: authUser.user_metadata?.state,
        preferred_language: authUser.user_metadata?.preferred_language,
        craft_category: authUser.user_metadata?.craft_category,
        onboarding_completed: !needsOnboarding,
      },
    };
  }, []);

  const loadSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error || !currentSession?.user) {
        setUser(null);
        setSession(null);
        setRole(null);
        setProfile(null);
        setNeedsOnboarding(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession.user);

      const { role: userRole, profile: userProfile, needsOnboarding: requiresOnboarding } = await fetchProfile(
        currentSession.user.id,
        currentSession.user
      );
      setRole(userRole);
      setProfile(userProfile);
      setNeedsOnboarding(requiresOnboarding);

    } catch {
      setUser(null);
      setSession(null);
      setRole(null);
      setProfile(null);
      setNeedsOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_OUT' || !newSession) {
        setUser(null);
        setSession(null);
        setRole(null);
        setProfile(null);
        setNeedsOnboarding(false);
        setIsLoading(false);

        // If on protected page, redirect out
        if (pathname?.startsWith('/artisan') || pathname?.startsWith('/admin')) {
          router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`);
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(newSession);
        setUser(newSession.user);
        const { role: userRole, profile: userProfile, needsOnboarding: requiresOnboarding } = await fetchProfile(
          newSession.user.id,
          newSession.user
        );
        setRole(userRole);
        setProfile(userProfile);
        setNeedsOnboarding(requiresOnboarding);
        setIsLoading(false);

      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSession, pathname, router, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      return { error };
    }

    if (data.user) {
      setUser(data.user);
      setSession(data.session);
      const { role: userRole, profile: userProfile } = await fetchProfile(data.user.id, data.user);
      setRole(userRole);
      setProfile(userProfile);

    }

    setIsLoading(false);
    return { error: null };
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    setIsLoading(true);
    const redirectUrl = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        setIsLoading(false);
        return { error };
      }

      if (data?.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }
      return { error: null };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err };
    }
  };

  const signInWithMagicLink = async (email: string, redirectTo?: string) => {
    setIsLoading(true);
    const redirectUrl = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true,
      },
    });
    setIsLoading(false);
    return { error };
  };

  const verifyOtp = async (email: string, token: string) => {
    setIsLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedToken = token.trim();

    // First try 'email' type (standard 6-digit email OTP)
    let { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: 'email',
    });

    // If 'email' fails, try 'magiclink'
    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: 'magiclink',
      });
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      setIsLoading(false);
      return { error };
    }

    if (data.user) {
      setUser(data.user);
      setSession(data.session);
      const { role: userRole, profile: userProfile } = await fetchProfile(data.user.id, data.user);
      setRole(userRole);
      setProfile(userProfile);

    }

    setIsLoading(false);
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    roleToAssign: UserRole,
    extraMeta?: Record<string, any>
  ) => {
    setIsLoading(true);
    // New registrations begin as customers. Artisan and administrator roles
    // are granted only by server-side Supabase administration workflows.
    const effectiveRole: UserRole = 'customer';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          onboarding_completed: true,
          ...(extraMeta || {}),
        },
      },
    });

    if (error) {
      setIsLoading(false);
      return { error };
    }

    if (data.user) {
      if (!data.session) {
        // Auto-login to obtain full persistent browser session immediately
        const signinResult = await signIn(email, password);
        if (!signinResult.error) {
          setIsLoading(false);
          return { error: null };
        }
      }

      setUser(data.user);
      setSession(data.session);
      setRole(effectiveRole);
      setNeedsOnboarding(false);

      const newProfile: UserProfile = {
        id: data.user.id,
        role: effectiveRole,
        full_name: fullName,
        phone: extraMeta?.phone || null,
        state: extraMeta?.state || 'Uttar Pradesh',
        craft_category: extraMeta?.craft_category || 'Varanasi Silk Brocade',
        preferred_language: extraMeta?.preferred_language || 'Hindi (हिंदी)',
        onboarding_completed: true,
      };
      setProfile(newProfile);

      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          role: effectiveRole,
          phone: extraMeta?.phone || null,
          state: extraMeta?.state || 'Uttar Pradesh',
          craft_category: extraMeta?.craft_category || 'Varanasi Silk Brocade',
          preferred_language: extraMeta?.preferred_language || 'Hindi (हिंदी)',
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        });
      } catch (upsertErr) {
        console.warn('Profile upsert note:', upsertErr);
      }

    }

    setIsLoading(false);
    return { error: null };
  };

  const completeOnboarding = async (details: {
    role: UserRole;
    fullName: string;
    phone: string;
    state?: string;
    craft_category?: string;
    preferred_language?: string;
    interest?: string;
  }) => {
    if (!user) return { error: new Error('No active user session') };
    setIsLoading(true);

    try {
      const appMetadataRole = user.app_metadata?.role;
      const assignedRole: UserRole = ['customer', 'artisan', 'admin', 'super_admin'].includes(appMetadataRole)
        ? appMetadataRole as UserRole
        : 'customer';

      // 1. Update user metadata in auth.users
      await supabase.auth.updateUser({
        data: {
          full_name: details.fullName,
          phone: details.phone,
          state: details.state,
          craft_category: details.craft_category,
          preferred_language: details.preferred_language,
          interest: details.interest,
          onboarding_completed: true,
        },
      });

      // 2. Update public.profiles in database
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: details.fullName,
          role: assignedRole,
          phone: details.phone,
          state: details.state,
          craft_category: details.craft_category,
          preferred_language: details.preferred_language,
          avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        });

      if (profileErr) {
        console.error('Error updating profile in Supabase:', profileErr);
        setIsLoading(false);
        return { error: new Error(profileErr.message || 'विवरण सहेजने में विफल (Failed to save profile).') };
      }

      setRole(assignedRole);
      setNeedsOnboarding(false);
      setProfile({
        id: user.id,
        role: assignedRole,
        full_name: details.fullName,
        phone: details.phone,
        state: details.state,
        craft_category: details.craft_category,
        preferred_language: details.preferred_language,
        avatar_url: profile?.avatar_url,
        onboarding_completed: true,
      });

      setIsLoading(false);
      return { error: null };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err };
    }
  };

  const refreshSession = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data?.session?.user) {
        setSession(data.session);
        setUser(data.session.user);
        const { role: userRole, profile: userProfile, needsOnboarding: requiresOnboarding } = await fetchProfile(
          data.session.user.id,
          data.session.user
        );
        setRole(userRole);
        setProfile(userProfile);
        setNeedsOnboarding(requiresOnboarding);
      } else {
        await loadSession();
      }
    } catch {
      await loadSession();
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Continue cleanup
    }
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    setIsLoading(false);
    router.push('/login');
  };

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isArtisan = role === 'artisan';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        profile,
        isLoading,
        needsOnboarding,
        isAdmin,
        isSuperAdmin,
        isArtisan,
        signIn,
        signInWithGoogle,
        signInWithMagicLink,
        verifyOtp,
        signUp,
        completeOnboarding,
        refreshSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
