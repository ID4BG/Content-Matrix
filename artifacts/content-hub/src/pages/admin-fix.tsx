import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminFix() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"running" | "done" | "error">("running");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/fix-ownership", { method: "POST" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Request failed");
        setMessage(data.message ?? "Done");
        setStatus("done");
        setTimeout(() => setLocation("/dashboard"), 2500);
      })
      .catch((err) => {
        setMessage(err.message ?? "Something went wrong");
        setStatus("error");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="border border-border p-10 max-w-sm w-full text-center space-y-4">
        {status === "running" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="font-semibold text-sm">Fixing permissions…</p>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
            <p className="font-semibold text-sm">{message}</p>
            <p className="text-xs text-muted-foreground">Redirecting to dashboard…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="font-semibold text-sm text-destructive">{message}</p>
            <Button variant="outline" className="rounded-none w-full" onClick={() => setLocation("/dashboard")}>
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
