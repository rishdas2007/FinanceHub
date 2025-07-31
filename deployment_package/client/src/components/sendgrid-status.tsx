import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Mail, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SendGridStatus {
  status: string;
  apiKeyValid?: boolean;
  errorCode?: number;
  errorMessage?: string;
  diagnosis?: string;
  nextSteps?: string[];
}

export function SendGridStatus() {
  const [status, setStatus] = useState<SendGridStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const checkSendGridStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/email/sendgrid-status');
      const result = await response.json();
      setStatus(result);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check SendGrid status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSendGridStatus();
  }, []);

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SendGrid Email Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = () => {
    if (status.status === 'error') {
      return <Badge variant="destructive">Not Configured</Badge>;
    }
    if (status.apiKeyValid && status.errorCode === 403) {
      return <Badge variant="secondary">Needs Verification</Badge>;
    }
    if (status.apiKeyValid) {
      return <Badge variant="default">API Key Valid</Badge>;
    }
    return <Badge variant="destructive">API Key Invalid</Badge>;
  };

  const getStatusIcon = () => {
    if (status.apiKeyValid && status.errorCode === 403) {
      return <AlertCircle className="h-8 w-8 text-yellow-500" />;
    }
    if (status.apiKeyValid) {
      return <CheckCircle className="h-8 w-8 text-green-500" />;
    }
    return <AlertCircle className="h-8 w-8 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SendGrid Email Status
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkSendGridStatus}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Email delivery service configuration and status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium">{status.diagnosis || status.errorMessage}</p>
              {status.errorCode && (
                <p className="text-sm text-muted-foreground">Error Code: {status.errorCode}</p>
              )}
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {status.nextSteps && status.nextSteps.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Next Steps:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              {status.nextSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {status.errorCode === 403 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                  Sender Verification Required
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Your SendGrid API key is working, but you need to verify your sender email address.
                  This is a one-time setup process.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => window.open('https://app.sendgrid.com/settings/sender_auth', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open SendGrid Dashboard
                </Button>
              </div>
            </div>
          </div>
        )}

        {status.apiKeyValid && status.errorCode !== 403 && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800 dark:text-green-200">
                  SendGrid Ready
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your email system is configured and ready to send daily market updates.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}