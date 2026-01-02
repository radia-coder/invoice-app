"use client";
 
import { useState } from "react";
import logo from "@/public/logo.png";
 
export const FullScreenSignup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
 
  const validateEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };
 
  const validatePassword = (value: string) => {
    return value.length >= 8;
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
 
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    } else {
      setEmailError("");
    }
 
    if (!validatePassword(password)) {
      setPasswordError("Password must be at least 8 characters.");
      valid = false;
    } else {
      setPasswordError("");
    }
 
    if (valid) {
      setSubmitting(true);
      setError("");
      
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (res.ok) {
          window.location.href = '/dashboard';
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'Login failed.');
        }
      } catch (e) {
        console.error(e);
        setError('Login failed.');
      } finally {
        setSubmitting(false);
      }
    }
  };
 
  return (
    <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden p-4">
      <div className="w-full relative max-w-5xl overflow-hidden flex flex-col md:flex-row shadow-xl">
        <div className="w-full h-full z-2 absolute bg-gradient-to-t from-transparent to-black"></div>
        <div className="flex absolute z-2 overflow-hidden backdrop-blur-2xl">
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black via-[69%] to-white/30 opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black via-[69%] to-white/30 opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black via-[69%] to-white/30 opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black via-[69%] to-white/30 opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black via-[69%] to-white/30 opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black via-[69%] to-white/30 opacity-30 overflow-hidden"></div>
        </div>
        <div className="w-[15rem] h-[15rem] bg-blue-500 absolute z-1 rounded-full bottom-0"></div>
        <div className="w-[8rem] h-[5rem] bg-white absolute z-1 rounded-full bottom-0"></div>
        <div className="w-[8rem] h-[5rem] bg-white absolute z-1 rounded-full bottom-0 left-20"></div>
 
        <div className="bg-black text-white p-8 md:p-12 md:w-1/2 relative rounded-bl-3xl overflow-hidden" />
 
        <div className="p-8 md:p-12 md:w-1/2 flex flex-col bg-zinc-900 z-[99] text-white -mt-20">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="mb-4 flex items-center justify-center">
              <img
                src={logo.src}
                alt="InvoiceSystem logo"
                className="h-48 w-auto object-contain"
                loading="eager"
              />
            </div>
            <h2 className="text-3xl font-medium mb-2 tracking-tight">
              Sign In
            </h2>
            <p className="opacity-80">
              Welcome to Invoice System — Let's get started
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded p-2 mb-4">
              {error}
            </div>
          )}
 
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div>
              <label htmlFor="email" className="block text-sm mb-2">
                Your email
              </label>
              <input
                type="email"
                id="email"
                placeholder="admin@example.com"
                className={`text-sm w-full py-2 px-3 border rounded-lg focus:outline-none focus:ring-1 bg-white text-black focus:ring-[#7a67e7] ${
                  emailError ? "border-red-500" : "border-gray-300"
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!emailError}
                aria-describedby="email-error"
              />
              {emailError && (
                <p id="email-error" className="text-red-400 text-xs mt-1">
                  {emailError}
                </p>
              )}
            </div>
 
            <div>
              <label htmlFor="password" className="block text-sm mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                className={`text-sm w-full py-2 px-3 border rounded-lg focus:outline-none focus:ring-1 bg-white text-black focus:ring-[#7a67e7] ${
                  passwordError ? "border-red-500" : "border-gray-300"
                }`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!passwordError}
                aria-describedby="password-error"
              />
              {passwordError && (
                <p id="password-error" className="text-red-400 text-xs mt-1">
                  {passwordError}
                </p>
              )}
            </div>
 
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#7a67e7] hover:bg-[#6b59d6] text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
 
          </form>
        </div>
      </div>
    </div>
  );
};
