'use client';

import { cn } from '@/lib/utils';
import { Response } from './response';
import { Alert, AlertContent, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  InfoIcon,
  ClockIcon,
  FileCodeIcon,
  ShieldAlertIcon,
  AlertTriangleIcon,
  BugIcon,
  CodeIcon,
  FolderOpenIcon,
  ActivityIcon
} from 'lucide-react';

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  file?: string;
  line?: number;
}

interface FinalReportProps {
  status?: string;
  findings?: string;
  issues?: Issue[];
  files_checked?: string[];
  confidence?: string;
  relevant_context?: string[];
  workflow_data?: {
    startedAt?: number;
    endedAt?: number;
    suspendedAt?: number;
    resumedAt?: number;
    steps?: {
      [key: string]: any;
    };
    continuation_id?: string;
    review_type?: string;
    directory?: string;
    models?: {
      main?: string;
      expert?: string;
    };
  };
  intermediate_issues?: Issue[];
  className?: string;
}

export function FinalReport({
  status,
  findings,
  issues = [],
  files_checked = [],
  confidence,
  relevant_context = [],
  workflow_data,
  intermediate_issues = [],
  className
}: FinalReportProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ShieldAlertIcon className="size-4" />;
      case 'high':
        return <AlertTriangleIcon className="size-4" />;
      case 'medium':
        return <AlertCircleIcon className="size-4" />;
      case 'low':
        return <InfoIcon className="size-4" />;
      default:
        return <BugIcon className="size-4" />;
    }
  };

  const getStatusIcon = () => {
    if (status === 'completed') {
      return <CheckCircle2Icon className="size-5 text-green-600" />;
    } else if (status === 'suspended') {
      return <AlertCircleIcon className="size-5 text-yellow-600" />;
    }
    return <InfoIcon className="size-5 text-blue-600" />;
  };

  const getConfidenceColor = (conf?: string) => {
    switch (conf) {
      case 'very_high':
      case 'high':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
      case 'exploring':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDuration = (start?: number, end?: number) => {
    if (!start || !end) return null;
    const duration = end - start;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // Combine all issues (from final report and intermediate steps)
  const allIssues = [...issues, ...intermediate_issues];

  // Group issues by severity
  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const highIssues = allIssues.filter(i => i.severity === 'high');
  const mediumIssues = allIssues.filter(i => i.severity === 'medium');
  const lowIssues = allIssues.filter(i => i.severity === 'low');

  return (
    <Card className={cn('mt-4', className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span>Code Review Report</span>
            {workflow_data?.review_type && (
              <Badge variant="outline" className="ml-2">
                {workflow_data.review_type} review
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {confidence && (
              <span className={cn('text-sm font-medium', getConfidenceColor(confidence))}>
                Confidence: {confidence.replace('_', ' ')}
              </span>
            )}
            {status && (
              <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
                {status === 'completed' ? 'Completed' : status}
              </Badge>
            )}
          </div>
        </CardTitle>

        {/* Metadata Row */}
        <CardDescription className="flex flex-wrap gap-4 text-xs">
          {workflow_data?.directory && (
            <div className="flex items-center gap-1">
              <FolderOpenIcon className="size-3" />
              <span>{workflow_data.directory}</span>
            </div>
          )}
          {workflow_data?.startedAt && workflow_data?.endedAt && (
            <div className="flex items-center gap-1">
              <ClockIcon className="size-3" />
              <span>Duration: {formatDuration(workflow_data.startedAt, workflow_data.endedAt)}</span>
            </div>
          )}
          {workflow_data?.models && (
            <div className="flex items-center gap-1">
              <ActivityIcon className="size-3" />
              <span>Models: {workflow_data.models.main}{workflow_data.models.expert && workflow_data.models.expert !== workflow_data.models.main ? ` + ${workflow_data.models.expert}` : ''}</span>
            </div>
          )}
          {workflow_data?.continuation_id && (
            <div className="flex items-center gap-1">
              <CodeIcon className="size-3" />
              <span className="font-mono text-[10px]">{workflow_data.continuation_id}</span>
            </div>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Issues Summary Bar */}
        {allIssues.length > 0 && (
          <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-red-600">{criticalIssues.length}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
            <div className="flex-1 text-center border-l">
              <div className="text-2xl font-bold text-orange-600">{highIssues.length}</div>
              <div className="text-xs text-muted-foreground">High</div>
            </div>
            <div className="flex-1 text-center border-l">
              <div className="text-2xl font-bold text-yellow-600">{mediumIssues.length}</div>
              <div className="text-xs text-muted-foreground">Medium</div>
            </div>
            <div className="flex-1 text-center border-l">
              <div className="text-2xl font-bold text-blue-600">{lowIssues.length}</div>
              <div className="text-xs text-muted-foreground">Low</div>
            </div>
          </div>
        )}

        {/* Analysis Summary */}
        {findings && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <InfoIcon className="size-4" />
              Analysis Summary
            </h4>
            <Response className="pl-5 text-sm">
              {findings}
            </Response>
          </div>
        )}

        {/* All Issues (including intermediate) */}
        {allIssues.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BugIcon className="size-4" />
              Issues Identified ({allIssues.length})
            </h4>
            <div className="space-y-2">
              {/* Group by severity */}
                            {criticalIssues.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-red-600 uppercase tracking-wider">Critical Issues</h5>
                  {criticalIssues.map((issue, idx) => (
                    <Alert
                      key={`critical-${idx}`}
                      variant="destructive"
                      appearance="outline"
                      size="sm"
                    >
                      <AlertIcon>
                        {getSeverityIcon(issue.severity)}
                      </AlertIcon>
                      <AlertContent>
                        <AlertDescription>
                          <div className="flex items-center gap-2 mb-1">
                            {issue.file && (
                              <code className="text-xs bg-background px-1.5 py-0.5 rounded font-mono">
                                {issue.file}{issue.line ? `:${issue.line}` : ''}
                              </code>
                            )}
                          </div>
                          <p className="text-sm">{issue.description}</p>
                        </AlertDescription>
                      </AlertContent>
                    </Alert>
                  ))}
                </div>
              )}

                            {highIssues.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-orange-600 uppercase tracking-wider">High Priority</h5>
                  {highIssues.map((issue, idx) => (
                    <Alert
                      key={`high-${idx}`}
                      variant="destructive"
                      appearance="outline"
                      size="sm"
                    >
                      <AlertIcon>
                        {getSeverityIcon(issue.severity)}
                      </AlertIcon>
                      <AlertContent>
                        <AlertDescription>
                          <div className="flex items-center gap-2 mb-1">
                            {issue.file && (
                              <code className="text-xs bg-background px-1.5 py-0.5 rounded font-mono">
                                {issue.file}{issue.line ? `:${issue.line}` : ''}
                              </code>
                            )}
                          </div>
                          <p className="text-sm">{issue.description}</p>
                        </AlertDescription>
                      </AlertContent>
                    </Alert>
                  ))}
                </div>
              )}

                            {mediumIssues.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-yellow-600 uppercase tracking-wider">Medium Priority</h5>
                  {mediumIssues.map((issue, idx) => (
                    <Alert
                      key={`medium-${idx}`}
                      variant="warning"
                      appearance="outline"
                      size="sm"
                    >
                      <AlertIcon>
                        {getSeverityIcon(issue.severity)}
                      </AlertIcon>
                      <AlertContent>
                        <AlertDescription>
                          <div className="flex items-center gap-2 mb-1">
                            {issue.file && (
                              <code className="text-xs bg-background px-1.5 py-0.5 rounded font-mono">
                                {issue.file}{issue.line ? `:${issue.line}` : ''}
                              </code>
                            )}
                          </div>
                          <p className="text-sm">{issue.description}</p>
                        </AlertDescription>
                      </AlertContent>
                    </Alert>
                  ))}
                </div>
              )}

                            {lowIssues.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-blue-600 uppercase tracking-wider">Low Priority</h5>
                  {lowIssues.map((issue, idx) => (
                    <Alert
                      key={`low-${idx}`}
                      variant="info"
                      appearance="outline"
                      size="sm"
                    >
                      <AlertIcon>
                        {getSeverityIcon(issue.severity)}
                      </AlertIcon>
                      <AlertContent>
                        <AlertDescription>
                          <div className="flex items-center gap-2 mb-1">
                            {issue.file && (
                              <code className="text-xs bg-background px-1.5 py-0.5 rounded font-mono">
                                {issue.file}{issue.line ? `:${issue.line}` : ''}
                              </code>
                            )}
                          </div>
                          <p className="text-sm">{issue.description}</p>
                        </AlertDescription>
                      </AlertContent>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Context Information */}
        {relevant_context && relevant_context.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CodeIcon className="size-4" />
              Relevant Context
            </h4>
            <div className="flex flex-wrap gap-2">
              {relevant_context.map((context, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {context}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Files Reviewed */}
        {files_checked.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileCodeIcon className="size-4" />
              Files Reviewed ({files_checked.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {files_checked.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">•</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded truncate">
                    {file}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
