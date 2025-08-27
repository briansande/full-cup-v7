'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

/**
 * Minimal Auth component
 * - Signup / Login with email + password
 * - Shows signed-in user's email and Sign out button
 *
 * Keep styling minimal per instructions.
 */
export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    let mounted = true;

    async function fetchSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(data.session?.user ?? null);
      } catch {
        // ignore
      }
    }
    fetchSession();

    // Listen for auth state changes and update `user`
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      // unsubscribe if available
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If your Supabase project requires email confirmation, the user will
        // receive a confirmation email. We'll rely on that behavior for now.
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <div>
      {user ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div>Signed in as {user.email}</div>
            <Link href="/profile" className="px-2 py-1 border rounded text-sm">
              Profile
            </Link>
          </div>
          <button onClick={handleSignOut} className="mt-2 px-3 py-1 border rounded">
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="block text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border rounded px-2 py-1"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button type="submit" disabled={loading} className="px-3 py-1 border rounded">
              {loading ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              className="px-2 py-1 text-sm"
            >
              Switch to {mode === "signup" ? "Login" : "Sign up"}
            </button>
          </div>

          {error ? <div className="text-red-600 text-sm mt-1">{error}</div> : null}
        </form>
      )}
    </div>
  );
}