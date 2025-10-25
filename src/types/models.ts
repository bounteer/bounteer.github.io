// Job Description Models
export interface JobDescription {
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'internship';
  experience: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  techStack: string[];
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
}

// Call Setup Models
export interface CallSetup {
  url: string;
  platform: 'google-meet' | 'teams' | 'zoom';
  status: 'pending' | 'active' | 'completed' | 'failed';
  botDeployedAt?: Date;
  metadata?: {
    meetingId?: string;
    duration?: number;
    participants?: number;
  };
}

// Orbit Call Session Models
export interface OrbitCallSession {
  id: string;
  callSetup: CallSetup;
  jobDescription: JobDescription;
  createdAt: Date;
  updatedAt: Date;
  recordings?: CallRecording[];
  insights?: CallInsights;
}

export interface CallRecording {
  id: string;
  url: string;
  duration: number;
  transcription?: string;
  createdAt: Date;
}

export interface CallInsights {
  candidateAssessment: {
    technicalSkills: number;
    communication: number;
    cultureFit: number;
    overall: number;
  };
  keyTopics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  recommendations: string[];
}

// Form State Models
export interface JobDescriptionFormData {
  company_name: string;
  role_name: string;
  location: string;
  responsibility: string;
  minimum_requirement: string;
  preferred_requirement: string;
  perk: string;
  salary_range: string;
}

export interface CallSetupFormData {
  url: string;
}

// Utility types for form validation
export type JobDescriptionFormErrors = Partial<Record<keyof JobDescriptionFormData, string>>;
export type CallSetupFormErrors = Partial<Record<keyof CallSetupFormData, string>>;

// Default values
export const DEFAULT_JOB_DESCRIPTION: JobDescriptionFormData = {
  company_name: 'TechCorp Inc.',
  role_name: 'Senior Software Engineer',
  location: 'Remote',
  responsibility: `• Design and develop scalable web applications using modern frameworks
• Collaborate with cross-functional teams to deliver high-quality software solutions
• Mentor junior developers and participate in code reviews
• Lead technical discussions and contribute to architectural decisions
• Ensure code quality, performance, and security best practices`,
  minimum_requirement: `• 5+ years of software development experience
• Strong expertise in React and TypeScript
• Experience with Node.js and Express.js
• Knowledge of cloud platforms (AWS, Azure, or GCP)
• Familiarity with microservices architecture
• Experience with CI/CD pipelines and DevOps practices
• Strong problem-solving skills and attention to detail`,
  preferred_requirement: `• Experience with containerization (Docker, Kubernetes)
• Knowledge of serverless architectures
• Experience with GraphQL and REST APIs
• Familiarity with testing frameworks (Jest, Cypress)
• Understanding of database design and optimization
• Experience with monitoring and logging tools
• Open source contributions or technical blog writing`,
  perk: `• Competitive salary and equity package
• Remote work flexibility with home office stipend
• Professional development budget and conference attendance
• Comprehensive health, dental, and vision insurance
• 401(k) matching and retirement planning assistance
• Flexible PTO and sabbatical opportunities
• Collaborative and innovative work environment`,
  salary_range: '$120,000 - $180,000 USD annually, plus equity and benefits'
};

// Validation utilities
export const SUPPORTED_CALL_PLATFORMS = [
  'meet.google.com',
  'teams.microsoft.com',
  'zoom.us',
  'us02web.zoom.us',
  'teams.live.com'
] as const;

export const isValidCallUrl = (url: string): boolean => {
  const lowerUrl = url.toLowerCase();
  return SUPPORTED_CALL_PLATFORMS.some(platform => lowerUrl.includes(platform));
};

export const detectCallPlatform = (url: string): CallSetup['platform'] | null => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('meet.google.com')) return 'google-meet';
  if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('teams.live.com')) return 'teams';
  if (lowerUrl.includes('zoom.us')) return 'zoom';
  return null;
};