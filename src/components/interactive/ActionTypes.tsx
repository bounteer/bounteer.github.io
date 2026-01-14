import { Mail, ExternalLink } from "lucide-react";

// Base props for all action components
interface BaseActionProps {
  isCompleted: boolean;
  isEditing: boolean;
  editingText: string;
  onEditChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
}

// LinkedIn Outreach Action
interface LinkedinOutreachPayload {
  text?: string;
  company_name?: string;
  linkedin_search_url: string;
}

interface LinkedinOutreachActionProps extends BaseActionProps {
  payload: LinkedinOutreachPayload;
}

export function LinkedinOutreachAction({
  payload,
  isCompleted,
}: LinkedinOutreachActionProps) {
  return (
    <a
      href={payload.linkedin_search_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`text-xs flex items-center gap-1.5 linkedin-action ${isCompleted ? 'opacity-50' : ''}`}
    >
      <span className="bg-blue-600 linkedin-action:hover:bg-blue-700 text-white text-xs py-1 px-3 rounded-md cursor-pointer transition-colors font-medium linkedin-badge flex-shrink-0 whitespace-nowrap">
        Outreach on LinkedIn
      </span>
      <span className={`cursor-pointer transition-colors linkedin-text ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        reach out person in charge
      </span>
      <style>{`
        .linkedin-action:hover .linkedin-badge {
          background-color: rgb(29 78 216);
        }
        .linkedin-action:hover .linkedin-text {
          color: rgb(37 99 235);
          text-decoration: underline;
        }
        .linkedin-action:hover .linkedin-text.line-through {
          color: rgb(156 163 175);
        }
      `}</style>
    </a>
  );
}

// Orbit Company Call Schedule Action
interface OrbitCompanyCallSchedulePayload {
  text?: string;
  orbit_company_call_create_url: string;
}

interface OrbitCompanyCallScheduleActionProps extends BaseActionProps {
  payload: OrbitCompanyCallSchedulePayload;
}

export function OrbitCompanyCallScheduleAction({
  payload,
  isCompleted,
}: OrbitCompanyCallScheduleActionProps) {
  return (
    <a
      href={payload.orbit_company_call_create_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`text-xs flex items-center gap-1.5 orbit-action ${isCompleted ? 'opacity-50' : ''}`}
    >
      <span className="bg-orange-600 text-white text-xs py-1 px-3 rounded-md cursor-pointer transition-colors font-medium orbit-badge flex-shrink-0 whitespace-nowrap">
        Schedule Orbit Call
      </span>
      <span className={`cursor-pointer transition-colors orbit-text ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {payload.text || 'Schedule Orbit Company Call'}
      </span>
      <style>{`
        .orbit-action:hover .orbit-badge {
          background-color: rgb(194 65 12);
        }
        .orbit-action:hover .orbit-text {
          color: rgb(234 88 12);
          text-decoration: underline;
        }
        .orbit-action:hover .orbit-text.line-through {
          color: rgb(156 163 175);
        }
      `}</style>
    </a>
  );
}

// Orbit Company Call Review Action
interface OrbitCompanyCallReviewPayload {
  text?: string;
  orbit_company_call_id?: string;
  review_target?: string;
  review_url: string;
}

interface OrbitCompanyCallReviewActionProps extends BaseActionProps {
  payload: OrbitCompanyCallReviewPayload;
}

export function OrbitCompanyCallReviewAction({
  payload,
  isCompleted,
}: OrbitCompanyCallReviewActionProps) {
  return (
    <a
      href={payload.review_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`text-xs flex items-center gap-1.5 orbit-review-action ${isCompleted ? 'opacity-50' : ''}`}
    >
      <span className="bg-orange-600 text-white text-xs py-1 px-3 rounded-md cursor-pointer transition-colors font-medium orbit-review-badge flex-shrink-0 whitespace-nowrap">
        Review Orbit Call
      </span>
      <span className={`cursor-pointer transition-colors orbit-review-text ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {payload.text || 'Review Orbit Company Call'}
      </span>
      <style>{`
        .orbit-review-action:hover .orbit-review-badge {
          background-color: rgb(194 65 12);
        }
        .orbit-review-action:hover .orbit-review-text {
          color: rgb(234 88 12);
          text-decoration: underline;
        }
        .orbit-review-action:hover .orbit-review-text.line-through {
          color: rgb(156 163 175);
        }
      `}</style>
    </a>
  );
}

// Email / Follow-up Action
interface EmailActionPayload {
  text?: string;
  email: string;
}

interface EmailActionProps extends BaseActionProps {
  payload: EmailActionPayload;
}

export function EmailAction({
  payload,
  isCompleted,
}: EmailActionProps) {
  return (
    <a
      href={`mailto:${payload.email}`}
      className={`text-xs flex items-center gap-1.5 hover:underline ${isCompleted ? 'text-gray-400 line-through' : 'text-green-600 hover:text-green-800'
        }`}
      onClick={(e) => e.stopPropagation()}
    >
      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{payload.text || 'Send email'}</span>
      <span className="text-gray-500">• {payload.email}</span>
    </a>
  );
}

// Manual Action (default)
interface ManualActionProps extends BaseActionProps {
  text: string;
  isReadOnly?: boolean;
}

export function ManualAction({
  text,
  isCompleted,
  isEditing,
  editingText,
  onEditChange,
  onSave,
  onCancel,
  onStartEdit,
  isReadOnly = false,
}: ManualActionProps) {
  if (isEditing) {
    return (
      <input
        type="text"
        value={editingText}
        onChange={(e) => onEditChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        autoFocus
        placeholder="Enter action description..."
        className="w-full text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <p
      className={`text-xs ${!isReadOnly ? 'cursor-text' : ''} ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'
        }`}
      onClick={(e) => {
        e.stopPropagation();
        if (!isReadOnly) {
          onStartEdit();
        }
      }}
    >
      {text || <span className="text-gray-400 italic">{!isReadOnly ? 'Click to add description...' : 'No description'}</span>}
    </p>
  );
}

// Helper function to parse payload safely
export function parsePayload(payload: any): any {
  if (!payload) return null;
  try {
    return typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    return null;
  }
}

// Helper function to extract text from payload
export function extractTextFromPayload(payload: any): string {
  if (!payload) return "";
  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    return parsed.text || "";
  } catch {
    return typeof payload === 'string' ? payload : "";
  }
}
