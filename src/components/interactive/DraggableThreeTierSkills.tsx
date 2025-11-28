"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, GripVertical } from "lucide-react";

export interface ThreeTierSkills {
  skill_core: string[];
  skill_plus: string[];
  skill_bonus: string[];
}

interface DraggableThreeTierSkillsProps {
  skills: ThreeTierSkills;
  onChange: (skills: ThreeTierSkills) => void;
  disabled?: boolean;
}

type SkillTier = 'skill_core' | 'skill_plus' | 'skill_bonus';

const tierConfig = {
  skill_core: {
    label: "Core Skills",
    description: "Must-have skills",
    bgColor: "bg-red-50 border-red-200",
    textColor: "text-red-700",
    buttonColor: "text-red-400 hover:text-red-600 hover:bg-red-50",
    dragOverColor: "border-red-400 bg-red-100",
    icon: "🔥"
  },
  skill_plus: {
    label: "Plus Skills", 
    description: "Nice-to-have skills",
    bgColor: "bg-blue-50 border-blue-200",
    textColor: "text-blue-700",
    buttonColor: "text-blue-400 hover:text-blue-600 hover:bg-blue-50",
    dragOverColor: "border-blue-400 bg-blue-100",
    icon: "⭐"
  },
  skill_bonus: {
    label: "Bonus Skills",
    description: "Extra skills",
    bgColor: "bg-green-50 border-green-200", 
    textColor: "text-green-700",
    buttonColor: "text-green-400 hover:text-green-600 hover:bg-green-50",
    dragOverColor: "border-green-400 bg-green-100",
    icon: "🎯"
  }
};

export function DraggableThreeTierSkills({
  skills,
  onChange,
  disabled = false
}: DraggableThreeTierSkillsProps) {
  const [newSkills, setNewSkills] = useState<Record<SkillTier, string>>({
    skill_core: "",
    skill_plus: "",
    skill_bonus: ""
  });
  const [draggedSkill, setDraggedSkill] = useState<{ skill: string; fromTier: SkillTier; index: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState<SkillTier | null>(null);
  const inputRefs = useRef<Record<SkillTier, HTMLInputElement | null>>({
    skill_core: null,
    skill_plus: null,
    skill_bonus: null
  });

  const addSkill = useCallback((tier: SkillTier) => {
    const trimmedSkill = newSkills[tier].trim();
    if (trimmedSkill && !skills[tier].includes(trimmedSkill)) {
      // Check if skill exists in any other tier
      const existsInOtherTier = Object.entries(skills).some(([otherTier, skillList]) => 
        otherTier !== tier && skillList.includes(trimmedSkill)
      );
      
      if (!existsInOtherTier) {
        onChange({
          ...skills,
          [tier]: [...skills[tier], trimmedSkill]
        });
        setNewSkills(prev => ({ ...prev, [tier]: "" }));
        inputRefs.current[tier]?.focus();
      }
    }
  }, [newSkills, skills, onChange]);

  const removeSkill = useCallback((tier: SkillTier, index: number) => {
    const newTierSkills = skills[tier].filter((_, i) => i !== index);
    onChange({
      ...skills,
      [tier]: newTierSkills
    });
  }, [skills, onChange]);

  const moveSkillWithinTier = useCallback((tier: SkillTier, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const tierSkills = [...skills[tier]];
    const [movedSkill] = tierSkills.splice(fromIndex, 1);
    tierSkills.splice(toIndex, 0, movedSkill);
    
    onChange({
      ...skills,
      [tier]: tierSkills
    });
  }, [skills, onChange]);

  const moveSkillBetweenTiers = useCallback((skill: string, fromTier: SkillTier, toTier: SkillTier, fromIndex: number) => {
    if (fromTier === toTier) return;

    // Remove from source tier
    const newFromTierSkills = skills[fromTier].filter((_, i) => i !== fromIndex);
    
    // Add to destination tier
    const newToTierSkills = [...skills[toTier], skill];
    
    onChange({
      ...skills,
      [fromTier]: newFromTierSkills,
      [toTier]: newToTierSkills
    });
  }, [skills, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, tier: SkillTier) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill(tier);
    }
  };

  const handleDragStart = (e: React.DragEvent, skill: string, tier: SkillTier, index: number) => {
    if (disabled) return;
    setDraggedSkill({ skill, fromTier: tier, index });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
    e.currentTarget.style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.style.opacity = "";
    setDraggedSkill(null);
    setIsDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent, tier: SkillTier) => {
    if (disabled || !draggedSkill) return;
    e.preventDefault();
    setIsDragOver(tier);
  };

  const handleDragLeave = () => {
    setIsDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, tier: SkillTier, dropIndex?: number) => {
    e.preventDefault();
    if (disabled || !draggedSkill) return;

    const { skill, fromTier, index: fromIndex } = draggedSkill;

    if (fromTier === tier) {
      // Moving within the same tier
      if (dropIndex !== undefined) {
        moveSkillWithinTier(tier, fromIndex, dropIndex);
      }
    } else {
      // Moving between tiers
      moveSkillBetweenTiers(skill, fromTier, tier, fromIndex);
    }

    setDraggedSkill(null);
    setIsDragOver(null);
  };

  const renderSkillTier = (tier: SkillTier) => {
    const config = tierConfig[tier];
    const tierSkills = skills[tier];

    return (
      <div key={tier} className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <span>{config.icon}</span>
          {config.label}
          <span className="text-xs text-gray-500">({config.description})</span>
        </Label>

        {/* Drop Zone Container */}
        <div
          className={`
            min-h-[120px] border-2 border-dashed rounded-lg p-3 transition-colors
            ${isDragOver === tier ? config.dragOverColor : 'border-gray-200'}
            ${disabled ? 'opacity-60' : ''}
          `}
          onDragOver={(e) => handleDragOver(e, tier)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, tier)}
        >
          {/* Skills List */}
          <div className="space-y-2 mb-3">
            <AnimatePresence>
              {tierSkills.map((skill, index) => (
                <motion.div
                  key={skill}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                  layout
                  className={`
                    group flex items-center gap-2 p-2 border rounded-lg cursor-move
                    ${config.bgColor}
                    ${draggedSkill?.skill === skill ? "opacity-50" : ""}
                    ${disabled ? "cursor-not-allowed opacity-60" : "hover:shadow-sm"}
                  `}
                  draggable={!disabled}
                  onDragStart={(e) => handleDragStart(e, skill, tier, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDrop(e, tier, index);
                  }}
                >
                  {/* Drag Handle */}
                  <div className={`
                    flex items-center justify-center w-4 h-4 ${config.buttonColor}
                  `}>
                    <GripVertical className="w-3 h-3" />
                  </div>

                  {/* Skill Text */}
                  <span className={`flex-1 text-sm font-medium ${config.textColor}`}>
                    {skill}
                  </span>

                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`w-6 h-6 p-0 ${config.buttonColor}`}
                    onClick={() => removeSkill(tier, index)}
                    disabled={disabled}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add New Skill Input */}
          {!disabled && (
            <div className="flex gap-2">
              <Input
                ref={(el) => { inputRefs.current[tier] = el; }}
                type="text"
                placeholder={`Add ${config.label.toLowerCase()}...`}
                value={newSkills[tier]}
                onChange={(e) => setNewSkills(prev => ({ ...prev, [tier]: e.target.value }))}
                onKeyDown={(e) => handleKeyDown(e, tier)}
                className="flex-1 text-sm"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSkill(tier)}
                disabled={!newSkills[tier].trim() || disabled}
                className="px-3 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Skills Requirements</h3>
        <p className="text-sm text-gray-600">
          Drag and drop skills between categories. Skills can be moved within the same tier to reorder by priority.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {(Object.keys(tierConfig) as SkillTier[]).map(tier => renderSkillTier(tier))}
      </div>
    </div>
  );
}