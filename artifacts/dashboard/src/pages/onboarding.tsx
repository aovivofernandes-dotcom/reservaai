import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/business/dashboard");
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
    </div>
  );
}
