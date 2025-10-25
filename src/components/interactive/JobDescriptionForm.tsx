"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JobDescriptionFormData, DEFAULT_JOB_DESCRIPTION, JobDescriptionFormErrors } from "@/types/models";

interface JobDescriptionFormProps {
  data?: Partial<JobDescriptionFormData>;
  onChange?: (data: JobDescriptionFormData) => void;
  onValidationChange?: (errors: JobDescriptionFormErrors) => void;
  className?: string;
}

export function JobDescriptionForm({
  data,
  onChange,
  onValidationChange,
  className = ""
}: JobDescriptionFormProps) {
  const [formData, setFormData] = useState<JobDescriptionFormData>({
    ...DEFAULT_JOB_DESCRIPTION,
    ...data
  });

  const [errors, setErrors] = useState<JobDescriptionFormErrors>({});

  const validateField = (name: keyof JobDescriptionFormData, value: string): string | undefined => {
    switch (name) {
      case 'company_name':
        return value.trim().length < 2 ? 'Company name must be at least 2 characters' : undefined;
      case 'role_name':
        return value.trim().length < 3 ? 'Role name must be at least 3 characters' : undefined;
      case 'location':
        return value.trim().length < 2 ? 'Location must be at least 2 characters' : undefined;
      case 'responsibility':
        return value.trim().length < 10 ? 'Responsibilities must be at least 10 characters' : undefined;
      case 'minimum_requirement':
        return value.trim().length < 10 ? 'Minimum requirements must be at least 10 characters' : undefined;
      default:
        return undefined;
    }
  };

  const handleChange = (name: keyof JobDescriptionFormData, value: string) => {
    const newData = { ...formData, [name]: value };
    setFormData(newData);

    // Validate the field
    const error = validateField(name, value);
    const newErrors = { ...errors };

    if (error) {
      newErrors[name] = error;
    } else {
      delete newErrors[name];
    }

    setErrors(newErrors);

    // Call callbacks
    onChange?.(newData);
    onValidationChange?.(newErrors);
  };

  const textareaFields = [
    {
      key: 'responsibility' as const,
      label: 'Responsibilities',
      placeholder: 'Describe the key responsibilities for this role...',
      required: true
    },
    {
      key: 'minimum_requirement' as const,
      label: 'Minimum Requirements',
      placeholder: 'List the essential requirements for this position...',
      required: true
    },
    {
      key: 'preferred_requirement' as const,
      label: 'Preferred Requirements',
      placeholder: 'List the nice-to-have requirements...'
    },
    {
      key: 'perk' as const,
      label: 'Perks & Benefits',
      placeholder: 'Describe the benefits and perks offered...'
    },
    {
      key: 'salary_range' as const,
      label: 'Salary Range',
      placeholder: 'e.g., $80,000 - $120,000 USD annually'
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Input Fields */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company_name">
            Company Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => handleChange('company_name', e.target.value)}
            placeholder="Enter company name"
            className={errors.company_name ? 'border-red-500' : ''}
          />
          {errors.company_name && (
            <p className="text-sm text-red-500">{errors.company_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role_name">
            Role Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="role_name"
            value={formData.role_name}
            onChange={(e) => handleChange('role_name', e.target.value)}
            placeholder="Enter role title"
            className={errors.role_name ? 'border-red-500' : ''}
          />
          {errors.role_name && (
            <p className="text-sm text-red-500">{errors.role_name}</p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="location">
            Location <span className="text-red-500">*</span>
          </Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="e.g., Remote, New York, NY, San Francisco, CA"
            className={errors.location ? 'border-red-500' : ''}
          />
          {errors.location && (
            <p className="text-sm text-red-500">{errors.location}</p>
          )}
        </div>
      </div>

      {/* Textarea Fields */}
      <div className="space-y-4">
        {textareaFields.map(({ key, label, placeholder, required }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={key}>
              {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id={key}
              value={formData[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className={`min-h-[120px] resize-none ${errors[key] ? 'border-red-500' : ''}`}
            />
            {errors[key] && (
              <p className="text-sm text-red-500">{errors[key]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}