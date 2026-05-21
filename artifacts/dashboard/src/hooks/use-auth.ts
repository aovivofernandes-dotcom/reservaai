import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export function useAuth() {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem("admin_token");
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem("admin_token");
      setIsAuthenticated(!!token);
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = (token: string) => {
    localStorage.setItem("admin_token", token);
    setIsAuthenticated(true);
    // Ensure the getter is set in case it hasn't been picked up
    setAuthTokenGetter(() => localStorage.getItem("admin_token"));
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    setIsAuthenticated(false);
    setLocation("/login");
  };

  return {
    isAuthenticated,
    login,
    logout
  };
}
