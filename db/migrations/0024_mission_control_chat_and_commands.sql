-- Migration: 0024_mission_control_chat_and_commands.sql
-- Description: Additive schema for persistent Mission Control staff conversations,
-- message threads, and structured operator command queue.
-- Milestone: HERMES-MC-5
-- INVARIANT: LOCAL ADDITIVE MIGRATION ONLY. DO NOT APPLY TO PRODUCTION UNTIL SEPARATELY AUTHORIZED.

-- 1. Mission Control Staff Conversations
CREATE TABLE IF NOT EXISTS mission_control_conversations (
  conversation_id TEXT PRIMARY KEY,
  staff_agent_id TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL DEFAULT 'operator',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_mc_conv_agent ON mission_control_conversations(staff_agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_conv_status ON mission_control_conversations(status);

-- 2. Mission Control Messages
CREATE TABLE IF NOT EXISTS mission_control_messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK(sender_type IN ('OPERATOR', 'STAFF', 'SYSTEM')),
  sender_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK(message_type IN ('TEXT', 'COMMAND_REQUEST', 'COMMAND_STATUS', 'TASK_RESULT', 'SYSTEM_NOTICE', 'ERROR')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  related_command_id TEXT,
  related_task_id TEXT,
  metadata_json TEXT,
  FOREIGN KEY (conversation_id) REFERENCES mission_control_conversations(conversation_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mc_msg_conv ON mission_control_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mc_msg_command ON mission_control_messages(related_command_id);
CREATE INDEX IF NOT EXISTS idx_mc_msg_created_at ON mission_control_messages(created_at);

-- 3. Structured Operator Command Queue
CREATE TABLE IF NOT EXISTS mission_control_commands (
  command_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  target_department_id TEXT NOT NULL,
  operator_message TEXT NOT NULL,
  normalized_intent TEXT NOT NULL,
  command_type TEXT NOT NULL,
  parameters_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('DRAFT', 'QUEUED', 'ACCEPTED', 'RUNNING', 'COMPLETED', 'REJECTED', 'BLOCKED', 'FAILED', 'CANCELLED')),
  authority_level TEXT NOT NULL CHECK(authority_level IN ('READ_ONLY', 'OPERATOR_COMMAND', 'ADMIN_CONTROL', 'DANGEROUS_PRODUCTION_ACTION')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  result_summary TEXT,
  task_reference TEXT,
  error_class TEXT,
  FOREIGN KEY (conversation_id) REFERENCES mission_control_conversations(conversation_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mc_cmd_conv ON mission_control_commands(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mc_cmd_agent ON mission_control_commands(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_cmd_status ON mission_control_commands(status);
CREATE INDEX IF NOT EXISTS idx_mc_cmd_created ON mission_control_commands(created_at);
