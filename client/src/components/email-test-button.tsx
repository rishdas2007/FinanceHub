import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Send, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function EmailTestButton() {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

  const handleTestEmail = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/email/test-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      setTestResult(result);

      if (response.ok) {
        toast({
          title: "Test Email Triggered",
          description: `Email processing completed for ${result.subscriptions} subscriber(s)`,
          duration: 5000,
        });
      } else {
        toast({
          title: "Test Failed",
          description: result.message || "Failed to send test email",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Test Error",
        description: "Failed to trigger test email",
        variant: "destructive",
      });
      setTestResult({ error: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleTestEmail}
        disabled={isTesting}
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isTesting ? (
          <>
            <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
            Testing Email...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Test Daily Email
          </>
        )}
      </Button>

      {testResult && (
        <div className="bg-financial-card rounded-lg p-4 text-sm">
          <div className="flex items-center gap-2 mb-2">
            {testResult.error ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-400" />
            )}
            <span className="font-semibold text-white">Test Result</span>
          </div>
          
          <div className="space-y-2 text-gray-300">
            <div>Message: {testResult.message}</div>
            {testResult.subscriptions !== undefined && (
              <div>Active Subscriptions: {testResult.subscriptions}</div>
            )}
            {testResult.sendGridEnabled !== undefined && (
              <div>SendGrid Status: {testResult.sendGridEnabled ? 'Enabled' : 'Disabled'}</div>
            )}
            {testResult.error && (
              <div className="text-red-400">Error: {testResult.error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}