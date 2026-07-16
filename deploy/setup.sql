-- Required Schema for Remote Database Sync
CREATE TABLE gaps (
  id text PRIMARY KEY,
  "displayId" text,
  ttp text,
  simulation text,
  finding text,
  outcome text,
  "coverageRating" text,
  details text,
  status text,
  severity text,
  "priorityScore" numeric,
  "createdDate" text,
  "resolvedDate" text,
  "resolutionNotes" text,
  "validationNotes" text,
  "riskAcceptedBy" text,
  "riskJustification" text,
  "riskAcceptedDate" text,
  environment jsonb,
  "actionItems" text,
  tags jsonb,
  stakeholders jsonb,
  "ticketLink" text,
  "aiRemediation" text,
  "todoList" jsonb
);

CREATE TABLE exercises (
  id text PRIMARY KEY,
  ttp text,
  simulation text,
  finding text,
  outcome text,
  "coverageRating" text,
  remediation text,
  status text,
  environment jsonb,
  tags jsonb,
  "securityControls" jsonb,
  date text
);

CREATE TABLE simulations (
  id text PRIMARY KEY,
  summary jsonb,
  evidence jsonb
);

-- Note: In a production environment, you should also apply Row Level Security (RLS) policies to these tables 
-- to restrict access based on authenticated user IDs.
