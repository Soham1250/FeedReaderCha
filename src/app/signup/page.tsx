"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { Github, Chrome, Sparkles } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full border border-border rounded-lg bg-surface p-8 shadow-md">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <span className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-xl shadow-sm mb-4">
            F
          </span>
          <h2 className="font-sans font-bold text-2xl tracking-tight mb-2">Create your account</h2>
          <p className="font-sans text-sm text-text-secondary">
            Join Frontpage to organize and customize your RSS content feeds, bookmark articles, and sync settings across devices.
          </p>
        </div>

        {/* Auth Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            className="w-full h-11 flex items-center justify-center gap-3 bg-[#24292F] hover:bg-[#24292F]/90 text-white font-sans font-semibold rounded-md shadow-sm transition-colors cursor-pointer"
          >
            <Github className="h-5 w-5" />
            Sign up with GitHub
          </button>

          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full h-11 flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 border border-border font-sans font-semibold rounded-md shadow-sm transition-colors cursor-pointer"
          >
            <Chrome className="h-5 w-5 text-red-500" />
            Sign up with Google
          </button>
        </div>

        {/* Existing account link */}
        <p className="text-center text-xs text-text-secondary mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent font-semibold hover:underline">
            Sign In
          </Link>
        </p>

        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink mx-4 text-text-tertiary text-xs font-semibold uppercase tracking-wider">Or</span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        {/* Guest fallback CTA */}
        <div className="flex flex-col gap-4 text-center">
          <Link
            href="/dashboard?mode=guest"
            className="w-full h-11 border border-dashed border-accent/40 text-accent bg-accent-subtle hover:bg-accent-subtle/80 flex items-center justify-center gap-2 font-sans font-semibold rounded-md transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Explore as a Guest
          </Link>
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            Try guest mode first to experience the dashboard. None of your settings or bookmarks will be stored to the cloud.
          </p>
        </div>
      </div>
    </div>
  );
}
