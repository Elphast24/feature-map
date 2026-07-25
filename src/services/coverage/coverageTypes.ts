import { Requirement } from "../../models/requirement";
import { Task } from "../../models/task";

export enum RequirementCoverageStatus {
  Covered = "covered",
  Partial = "partial",
  Uncovered = "uncovered",
}

export interface RequirementCoverage {
  requirement: Requirement;
  tasks: Task[];
  completedTaskCount: number;
  status: RequirementCoverageStatus;
}


export interface OrphanTask {
  task: Task;
  moduleName: string;
  phaseName: string;
}

export interface CoverageReport {
  totalRequirements: number;
  coveredCount: number;
  partialCount: number;
  uncoveredCount: number;
  coveragePercentage: number;
  addressablePercentage: number;
  requirements: RequirementCoverage[];
  orphanTasks: OrphanTask[];
  description: string;
  warnings: string[];
}