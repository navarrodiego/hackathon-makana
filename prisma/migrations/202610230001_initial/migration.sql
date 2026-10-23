-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "executions" (
    "executionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "anchor" JSONB NOT NULL,
    "channelOpen" BOOLEAN NOT NULL,
    "admittedReports" INTEGER NOT NULL,
    "preparation" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "supersededBy" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("executionId")
);

-- CreateTable
CREATE TABLE "actors" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "narrativeAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_windows" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "outgoingActorId" TEXT NOT NULL,
    "outgoingEndsAt" TIMESTAMPTZ(3) NOT NULL,
    "incomingActorId" TEXT NOT NULL,
    "backupActorIds" TEXT[],
    "coordinatorActorId" TEXT NOT NULL,

    CONSTRAINT "coverage_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "suggestedDisposition" TEXT,
    "disposition" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "incidentId" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoffs" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "windowId" TEXT NOT NULL,
    "outgoingActorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentAttemptId" TEXT,
    "ticketIds" TEXT[],
    "note" TEXT NOT NULL,
    "savedSuggestion" JSONB,
    "sentAt" TIMESTAMPTZ(3),
    "acceptedAt" TIMESTAMPTZ(3),
    "acceptedBy" TEXT,
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoff_attempts" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "handoffId" TEXT NOT NULL,
    "candidateActorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "respondedAt" TIMESTAMPTZ(3),

    CONSTRAINT "handoff_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverages" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "windowId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorId" TEXT,
    "acceptedAt" TIMESTAMPTZ(3),

    CONSTRAINT "coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_sessions" (
    "id" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient_grants" (
    "credentialHash" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipient_grants_pkey" PRIMARY KEY ("credentialHash")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "admissionSequence" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "operationalAt" TIMESTAMPTZ(3) NOT NULL,
    "narrativeAt" TIMESTAMPTZ(3) NOT NULL,
    "correlationId" TEXT NOT NULL,
    "principalKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "incidentId" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_classifications" (
    "reportId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "report_classifications_pkey" PRIMARY KEY ("reportId")
);

-- CreateTable
CREATE TABLE "report_policy_decisions" (
    "reportId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "report_policy_decisions_pkey" PRIMARY KEY ("reportId")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "firstReportId" TEXT NOT NULL,
    "equivalence" JSONB NOT NULL,
    "equivalenceHash" TEXT NOT NULL,
    "firstNarrativeAt" TIMESTAMPTZ(3) NOT NULL,
    "currentAttemptId" TEXT,
    "takenBy" TEXT,
    "takenAt" TIMESTAMPTZ(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_attempts" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "incidentId" TEXT NOT NULL,
    "candidateActorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "respondedAt" TIMESTAMPTZ(3),

    CONSTRAINT "incident_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "entity" JSONB NOT NULL,
    "entityVersion" INTEGER NOT NULL,
    "actorId" TEXT,
    "principal" JSONB NOT NULL,
    "origin" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "operationalAt" TIMESTAMPTZ(3) NOT NULL,
    "narrativeAt" TIMESTAMPTZ(3) NOT NULL,
    "correlationId" TEXT NOT NULL,
    "result" TEXT NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_intents" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" JSONB NOT NULL,
    "recipientActorId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "logicalKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "executionId" TEXT NOT NULL,
    "principalKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL,
    "response" JSONB,
    "successorExecutionId" TEXT,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("executionId","principalKey","operation","key")
);

-- CreateIndex
CREATE INDEX "actors_executionId_idx" ON "actors"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "actors_executionId_id_key" ON "actors"("executionId", "id");

-- CreateIndex
CREATE INDEX "scenes_executionId_idx" ON "scenes"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_executionId_id_key" ON "scenes"("executionId", "id");

-- CreateIndex
CREATE INDEX "coverage_windows_executionId_idx" ON "coverage_windows"("executionId");

-- CreateIndex
CREATE INDEX "coverage_windows_executionId_outgoingActorId_idx" ON "coverage_windows"("executionId", "outgoingActorId");

-- CreateIndex
CREATE INDEX "coverage_windows_executionId_incomingActorId_idx" ON "coverage_windows"("executionId", "incomingActorId");

-- CreateIndex
CREATE INDEX "coverage_windows_executionId_coordinatorActorId_idx" ON "coverage_windows"("executionId", "coordinatorActorId");

-- CreateIndex
CREATE UNIQUE INDEX "coverage_windows_executionId_id_key" ON "coverage_windows"("executionId", "id");

-- CreateIndex
CREATE INDEX "tickets_executionId_idx" ON "tickets"("executionId");

-- CreateIndex
CREATE INDEX "tickets_executionId_incidentId_idx" ON "tickets"("executionId", "incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_executionId_id_key" ON "tickets"("executionId", "id");

-- CreateIndex
CREATE INDEX "handoffs_executionId_idx" ON "handoffs"("executionId");

-- CreateIndex
CREATE INDEX "handoffs_executionId_windowId_idx" ON "handoffs"("executionId", "windowId");

-- CreateIndex
CREATE INDEX "handoffs_executionId_outgoingActorId_idx" ON "handoffs"("executionId", "outgoingActorId");

-- CreateIndex
CREATE INDEX "handoffs_executionId_acceptedBy_idx" ON "handoffs"("executionId", "acceptedBy");

-- CreateIndex
CREATE INDEX "handoffs_executionId_currentAttemptId_idx" ON "handoffs"("executionId", "currentAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "handoffs_executionId_id_key" ON "handoffs"("executionId", "id");

-- CreateIndex
CREATE INDEX "handoff_attempts_executionId_idx" ON "handoff_attempts"("executionId");

-- CreateIndex
CREATE INDEX "handoff_attempts_executionId_candidateActorId_idx" ON "handoff_attempts"("executionId", "candidateActorId");

-- CreateIndex
CREATE UNIQUE INDEX "handoff_attempts_executionId_id_key" ON "handoff_attempts"("executionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "handoff_attempts_executionId_handoffId_position_key" ON "handoff_attempts"("executionId", "handoffId", "position");

-- CreateIndex
CREATE INDEX "coverages_executionId_idx" ON "coverages"("executionId");

-- CreateIndex
CREATE INDEX "coverages_executionId_windowId_idx" ON "coverages"("executionId", "windowId");

-- CreateIndex
CREATE INDEX "coverages_executionId_actorId_idx" ON "coverages"("executionId", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "coverages_executionId_id_key" ON "coverages"("executionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "report_sessions_credentialHash_key" ON "report_sessions"("credentialHash");

-- CreateIndex
CREATE INDEX "recipient_grants_executionId_idx" ON "recipient_grants"("executionId");

-- CreateIndex
CREATE INDEX "recipient_grants_executionId_actorId_idx" ON "recipient_grants"("executionId", "actorId");

-- CreateIndex
CREATE INDEX "reports_executionId_idx" ON "reports"("executionId");

-- CreateIndex
CREATE INDEX "reports_executionId_sessionId_idx" ON "reports"("executionId", "sessionId");

-- CreateIndex
CREATE INDEX "reports_executionId_status_admissionSequence_idx" ON "reports"("executionId", "status", "admissionSequence");

-- CreateIndex
CREATE INDEX "reports_sessionId_idx" ON "reports"("sessionId");

-- CreateIndex
CREATE INDEX "reports_executionId_incidentId_idx" ON "reports"("executionId", "incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_executionId_id_key" ON "reports"("executionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_executionId_admissionSequence_key" ON "reports"("executionId", "admissionSequence");

-- CreateIndex
CREATE INDEX "report_classifications_executionId_idx" ON "report_classifications"("executionId");

-- CreateIndex
CREATE INDEX "report_policy_decisions_executionId_idx" ON "report_policy_decisions"("executionId");

-- CreateIndex
CREATE INDEX "incidents_executionId_idx" ON "incidents"("executionId");

-- CreateIndex
CREATE INDEX "incidents_executionId_equivalenceHash_firstNarrativeAt_idx" ON "incidents"("executionId", "equivalenceHash", "firstNarrativeAt");

-- CreateIndex
CREATE INDEX "incidents_executionId_firstReportId_idx" ON "incidents"("executionId", "firstReportId");

-- CreateIndex
CREATE INDEX "incidents_executionId_takenBy_idx" ON "incidents"("executionId", "takenBy");

-- CreateIndex
CREATE INDEX "incidents_executionId_currentAttemptId_idx" ON "incidents"("executionId", "currentAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_executionId_id_key" ON "incidents"("executionId", "id");

-- CreateIndex
CREATE INDEX "incident_attempts_executionId_idx" ON "incident_attempts"("executionId");

-- CreateIndex
CREATE INDEX "incident_attempts_executionId_candidateActorId_idx" ON "incident_attempts"("executionId", "candidateActorId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_attempts_executionId_id_key" ON "incident_attempts"("executionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "incident_attempts_executionId_incidentId_position_key" ON "incident_attempts"("executionId", "incidentId", "position");

-- CreateIndex
CREATE INDEX "events_executionId_idx" ON "events"("executionId");

-- CreateIndex
CREATE INDEX "events_executionId_actorId_idx" ON "events"("executionId", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "events_executionId_id_key" ON "events"("executionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "events_executionId_sequence_key" ON "events"("executionId", "sequence");

-- CreateIndex
CREATE INDEX "notification_intents_executionId_idx" ON "notification_intents"("executionId");

-- CreateIndex
CREATE INDEX "notification_intents_executionId_recipientActorId_idx" ON "notification_intents"("executionId", "recipientActorId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_intents_executionId_id_key" ON "notification_intents"("executionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_intents_executionId_logicalKey_key" ON "notification_intents"("executionId", "logicalKey");

-- CreateIndex
CREATE INDEX "idempotency_records_executionId_idx" ON "idempotency_records"("executionId");



-- Invariantes PostgreSQL no expresables mediante el schema Prisma.
ALTER TABLE "actors" ADD CONSTRAINT "actors_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "coverage_windows" ADD CONSTRAINT "coverage_windows_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "handoff_attempts" ADD CONSTRAINT "handoff_attempts_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "recipient_grants" ADD CONSTRAINT "recipient_grants_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reports" ADD CONSTRAINT "reports_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "report_classifications" ADD CONSTRAINT "report_classifications_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "report_policy_decisions" ADD CONSTRAINT "report_policy_decisions_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "incident_attempts" ADD CONSTRAINT "incident_attempts_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "events" ADD CONSTRAINT "events_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "notification_intents" ADD CONSTRAINT "notification_intents_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_execution_fk" FOREIGN KEY ("executionId") REFERENCES executions("executionId") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "executions" ADD CONSTRAINT "executions_sceneId_fk" FOREIGN KEY ("executionId", "sceneId") REFERENCES "scenes"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "executions" ADD CONSTRAINT "executions_supersededBy_fk" FOREIGN KEY ("supersededBy") REFERENCES "executions"("executionId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "coverage_windows" ADD CONSTRAINT "coverage_windows_outgoingActorId_fk" FOREIGN KEY ("executionId", "outgoingActorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "coverage_windows" ADD CONSTRAINT "coverage_windows_incomingActorId_fk" FOREIGN KEY ("executionId", "incomingActorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "coverage_windows" ADD CONSTRAINT "coverage_windows_coordinatorActorId_fk" FOREIGN KEY ("executionId", "coordinatorActorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_windowId_fk" FOREIGN KEY ("executionId", "windowId") REFERENCES "coverage_windows"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_outgoingActorId_fk" FOREIGN KEY ("executionId", "outgoingActorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_acceptedBy_fk" FOREIGN KEY ("executionId", "acceptedBy") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_currentAttemptId_fk" FOREIGN KEY ("executionId", "currentAttemptId") REFERENCES "handoff_attempts"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "handoff_attempts" ADD CONSTRAINT "handoff_attempts_handoffId_fk" FOREIGN KEY ("executionId", "handoffId") REFERENCES "handoffs"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "handoff_attempts" ADD CONSTRAINT "handoff_attempts_candidateActorId_fk" FOREIGN KEY ("executionId", "candidateActorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_windowId_fk" FOREIGN KEY ("executionId", "windowId") REFERENCES "coverage_windows"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_actorId_fk" FOREIGN KEY ("executionId", "actorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reports" ADD CONSTRAINT "reports_sessionId_fk" FOREIGN KEY ("sessionId") REFERENCES "report_sessions"("id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reports" ADD CONSTRAINT "reports_incidentId_fk" FOREIGN KEY ("executionId", "incidentId") REFERENCES "incidents"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "report_classifications" ADD CONSTRAINT "report_classifications_reportId_fk" FOREIGN KEY ("executionId", "reportId") REFERENCES "reports"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "report_policy_decisions" ADD CONSTRAINT "report_policy_decisions_reportId_fk" FOREIGN KEY ("executionId", "reportId") REFERENCES "reports"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_firstReportId_fk" FOREIGN KEY ("executionId", "firstReportId") REFERENCES "reports"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_currentAttemptId_fk" FOREIGN KEY ("executionId", "currentAttemptId") REFERENCES "incident_attempts"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_takenBy_fk" FOREIGN KEY ("executionId", "takenBy") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "incident_attempts" ADD CONSTRAINT "incident_attempts_incidentId_fk" FOREIGN KEY ("executionId", "incidentId") REFERENCES "incidents"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "incident_attempts" ADD CONSTRAINT "incident_attempts_candidateActorId_fk" FOREIGN KEY ("executionId", "candidateActorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "events" ADD CONSTRAINT "events_actorId_fk" FOREIGN KEY ("executionId", "actorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "notification_intents" ADD CONSTRAINT "notification_intents_recipientActorId_fk" FOREIGN KEY ("executionId", "recipientActorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "recipient_grants" ADD CONSTRAINT "recipient_grants_actorId_fk" FOREIGN KEY ("executionId", "actorId") REFERENCES "actors"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_successorExecutionId_fk" FOREIGN KEY ("successorExecutionId") REFERENCES "executions"("executionId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_incidentId_fk" FOREIGN KEY ("executionId", "incidentId") REFERENCES "incidents"("executionId", "id") DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX one_active_execution ON executions (status) WHERE status = 'active';
CREATE UNIQUE INDEX one_pending_handoff_attempt ON handoff_attempts ("executionId", "handoffId") WHERE status = 'pending';
CREATE UNIQUE INDEX one_pending_incident_attempt ON incident_attempts ("executionId", "incidentId") WHERE status = 'pending';
CREATE UNIQUE INDEX one_coverage_per_window ON coverages ("executionId", "windowId");
CREATE INDEX idempotency_successor_idx ON idempotency_records("successorExecutionId");
CREATE INDEX execution_successor_idx ON executions("supersededBy");
CREATE INDEX execution_scene_idx ON executions("executionId", "sceneId");
ALTER TABLE "executions" ADD CONSTRAINT "executions_version_positive" CHECK (version >= 1);
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_version_positive" CHECK (version >= 1);
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_version_positive" CHECK (version >= 1);
ALTER TABLE "handoff_attempts" ADD CONSTRAINT "handoff_attempts_version_positive" CHECK (version >= 1);
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_version_positive" CHECK (version >= 1);
ALTER TABLE "reports" ADD CONSTRAINT "reports_version_positive" CHECK (version >= 1);
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_version_positive" CHECK (version >= 1);
ALTER TABLE "incident_attempts" ADD CONSTRAINT "incident_attempts_version_positive" CHECK (version >= 1);
ALTER TABLE "notification_intents" ADD CONSTRAINT "notification_intents_version_positive" CHECK (version >= 1);
ALTER TABLE "executions" ADD CONSTRAINT "executions_status_allowed" CHECK (status IN ('active', 'superseded'));
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_status_allowed" CHECK (status IN ('draft', 'awaiting_candidate', 'accepted', 'uncovered'));
ALTER TABLE "handoff_attempts" ADD CONSTRAINT "handoff_attempts_status_allowed" CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'));
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_status_allowed" CHECK (status IN ('unconfirmed', 'scheduled', 'active', 'ended'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_status_allowed" CHECK (status IN ('processing', 'completed'));
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_status_allowed" CHECK (status IN ('awaiting_ack', 'taken', 'unacknowledged'));
ALTER TABLE "incident_attempts" ADD CONSTRAINT "incident_attempts_status_allowed" CHECK (status IN ('pending', 'accepted', 'expired'));
ALTER TABLE "notification_intents" ADD CONSTRAINT "notification_intents_status_allowed" CHECK (status IN ('pending', 'provider_accepted', 'in_app_recorded', 'failed', 'discarded'));
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_status_allowed" CHECK (status IN ('pending', 'completed'));
ALTER TABLE "executions" ADD CONSTRAINT "executions_preparation_allowed" CHECK (preparation IN ('pending','ready','failed'));
ALTER TABLE "executions" ADD CONSTRAINT "executions_admission_range" CHECK ("admittedReports" BETWEEN 0 AND 50);
ALTER TABLE "executions" ADD CONSTRAINT "executions_successor_state" CHECK ((status = 'active' AND "supersededBy" IS NULL) OR (status = 'superseded' AND "supersededBy" IS NOT NULL));
ALTER TABLE "coverage_windows" ADD CONSTRAINT "coverage_windows_window_order" CHECK ("startsAt" < "endsAt");
ALTER TABLE "handoff_attempts" ADD CONSTRAINT "handoff_attempts_deadline_order" CHECK ("requestedAt" < "deadlineAt" AND position >= 0);
ALTER TABLE "incident_attempts" ADD CONSTRAINT "incident_attempts_deadline_order" CHECK ("requestedAt" < "deadlineAt" AND position >= 0);
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_acceptance_shape" CHECK ((status='unconfirmed' AND "actorId" IS NULL AND "acceptedAt" IS NULL) OR (status<>'unconfirmed' AND "actorId" IS NOT NULL AND "acceptedAt" IS NOT NULL));
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_take_shape" CHECK ((status='taken' AND "takenBy" IS NOT NULL AND "takenAt" IS NOT NULL) OR (status<>'taken' AND "takenBy" IS NULL AND "takenAt" IS NULL));
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_completion_shape" CHECK ((status='pending' AND response IS NULL AND "successorExecutionId" IS NULL) OR (status='completed' AND response IS NOT NULL));
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_key_format" CHECK (key ~ '^[A-Za-z0-9._-]{1,128}$');
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_fingerprint_format" CHECK (fingerprint ~ '^[a-f0-9]{64}$');
ALTER TABLE "report_sessions" ADD CONSTRAINT "report_sessions_hash_format" CHECK ("credentialHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "recipient_grants" ADD CONSTRAINT "recipient_grants_hash_format" CHECK ("credentialHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "recipient_grants" ADD CONSTRAINT "recipient_grants_ttl" CHECK ("expiresAt" > "issuedAt" AND "expiresAt" <= "issuedAt" + interval '30 minutes');
ALTER TABLE "reports" ADD CONSTRAINT "reports_admission_positive" CHECK ("admissionSequence" >= 1);
ALTER TABLE "events" ADD CONSTRAINT "events_sequence_positive" CHECK (sequence >= 1 AND "entityVersion" >= 1);
ALTER TABLE "reports" ADD CONSTRAINT "reports_origin_allowed" CHECK (origin IN ('web','scenario'));
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_disposition_allowed" CHECK (disposition IN ('puede_esperar','transferir') AND ("suggestedDisposition" IS NULL OR "suggestedDisposition" IN ('puede_esperar','transferir')));
ALTER TABLE "executions" ADD CONSTRAINT "executions_id_prefix" CHECK ("executionId" ~ '^execution_.+');
ALTER TABLE "actors" ADD CONSTRAINT "actors_id_prefix" CHECK ("id" ~ '^actor_.+');
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_id_prefix" CHECK ("id" ~ '^scene_.+');
ALTER TABLE "coverage_windows" ADD CONSTRAINT "coverage_windows_id_prefix" CHECK ("id" ~ '^window_.+');
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_prefix" CHECK ("id" ~ '^ticket_.+');
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_id_prefix" CHECK ("id" ~ '^handoff_.+');
ALTER TABLE "handoff_attempts" ADD CONSTRAINT "handoff_attempts_id_prefix" CHECK ("id" ~ '^handoff_attempt_.+');
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_id_prefix" CHECK ("id" ~ '^coverage_.+');
ALTER TABLE "report_sessions" ADD CONSTRAINT "report_sessions_id_prefix" CHECK ("id" ~ '^session_.+');
ALTER TABLE "reports" ADD CONSTRAINT "reports_id_prefix" CHECK ("id" ~ '^report_.+');
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_id_prefix" CHECK ("id" ~ '^incident_.+');
ALTER TABLE "incident_attempts" ADD CONSTRAINT "incident_attempts_id_prefix" CHECK ("id" ~ '^incident_attempt_.+');
ALTER TABLE "events" ADD CONSTRAINT "events_id_prefix" CHECK ("id" ~ '^event_.+');
ALTER TABLE "notification_intents" ADD CONSTRAINT "notification_intents_id_prefix" CHECK ("id" ~ '^notification_.+');

-- Las referencias polimórficas/arrays conservan el shape de T01; se validan
-- al commit, incluso si se elimina un destino. Nunca consultan otra ejecución.
CREATE FUNCTION relevo_assert_ref(e text, kind text, target text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE present boolean; tab text;
BEGIN
  tab := CASE kind WHEN 'actor' THEN 'actors' WHEN 'ticket' THEN 'tickets'
    WHEN 'handoff' THEN 'handoffs' WHEN 'incident' THEN 'incidents'
    WHEN 'report' THEN 'reports' WHEN 'notification' THEN 'notification_intents'
    WHEN 'handoff_attempt' THEN 'handoff_attempts' WHEN 'incident_attempt' THEN 'incident_attempts' END;
  IF kind = 'execution' THEN
    present := target IS NOT NULL AND target = e;
  ELSIF tab IS NOT NULL THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE "executionId"=$1 AND id=$2)', tab) INTO present USING e, target;
  ELSE present := false;
  END IF;
  IF NOT coalesce(present,false) THEN RAISE EXCEPTION 'Invalid execution reference' USING ERRCODE='23503'; END IF;
END $$;

CREATE FUNCTION relevo_check_references() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e text; r record; v text; ref jsonb;
BEGIN
  e := CASE WHEN TG_OP='DELETE' THEN OLD."executionId" ELSE NEW."executionId" END;
  IF NOT EXISTS(SELECT 1 FROM executions WHERE "executionId"=e) THEN RETURN NULL; END IF;
  FOR r IN SELECT * FROM coverage_windows WHERE "executionId"=e LOOP
    FOREACH v IN ARRAY r."backupActorIds" LOOP PERFORM relevo_assert_ref(e,'actor',v); END LOOP;
  END LOOP;
  FOR r IN SELECT * FROM handoffs WHERE "executionId"=e LOOP
    FOREACH v IN ARRAY r."ticketIds" LOOP PERFORM relevo_assert_ref(e,'ticket',v); END LOOP;
    IF r."currentAttemptId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM handoff_attempts WHERE "executionId"=e AND id=r."currentAttemptId" AND "handoffId"=r.id) THEN
      RAISE EXCEPTION 'Attempt belongs to another handoff' USING ERRCODE='23503';
    END IF;
    IF r."savedSuggestion" IS NOT NULL THEN
      IF r."savedSuggestion"->>'executionId' IS DISTINCT FROM e THEN RAISE EXCEPTION 'Invalid note execution' USING ERRCODE='23503'; END IF;
      FOR ref IN SELECT value FROM jsonb_array_elements(r."savedSuggestion"->'output'->'suggestions') LOOP
        PERFORM relevo_assert_ref(e,'ticket',ref->>'ticketId');
      END LOOP;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM incidents WHERE "executionId"=e LOOP
    IF r."currentAttemptId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM incident_attempts WHERE "executionId"=e AND id=r."currentAttemptId" AND "incidentId"=r.id) THEN
      RAISE EXCEPTION 'Attempt belongs to another incident' USING ERRCODE='23503';
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM recipient_grants WHERE "executionId"=e LOOP
    PERFORM relevo_assert_ref(e,r.scope->>'entity',r.scope->>'entityId');
    IF r.scope->>'entity'='handoff' THEN
      IF NOT EXISTS(SELECT 1 FROM handoff_attempts WHERE "executionId"=e AND id=r.scope->>'attemptId' AND "handoffId"=r.scope->>'entityId' AND "candidateActorId"=r."actorId") THEN RAISE EXCEPTION 'Invalid grant attempt' USING ERRCODE='23503'; END IF;
    ELSIF r.scope->>'entity'='incident' THEN
      IF NOT EXISTS(SELECT 1 FROM incident_attempts WHERE "executionId"=e AND id=r.scope->>'attemptId' AND "incidentId"=r.scope->>'entityId' AND "candidateActorId"=r."actorId") THEN RAISE EXCEPTION 'Invalid grant attempt' USING ERRCODE='23503'; END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM notification_intents WHERE "executionId"=e LOOP
    IF r.subject->>'kind'='coordination' THEN
      ref := r.subject->'entity'; PERFORM relevo_assert_ref(e,ref->>'kind',ref->>'id');
    ELSE
      PERFORM relevo_assert_ref(e,r.subject->>'kind',r.subject->>'id');
      IF r.subject->>'kind'='handoff' THEN
        IF NOT EXISTS(SELECT 1 FROM handoff_attempts WHERE "executionId"=e AND id=r.subject->>'attemptId' AND "handoffId"=r.subject->>'id') THEN RAISE EXCEPTION 'Invalid notice attempt' USING ERRCODE='23503'; END IF;
      ELSIF r.subject->>'kind'='incident' THEN
        IF NOT EXISTS(SELECT 1 FROM incident_attempts WHERE "executionId"=e AND id=r.subject->>'attemptId' AND "incidentId"=r.subject->>'id') THEN RAISE EXCEPTION 'Invalid notice attempt' USING ERRCODE='23503'; END IF;
      END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM events WHERE "executionId"=e LOOP
    PERFORM relevo_assert_ref(e,r.entity->>'kind',r.entity->>'id');
    IF r.principal->>'kind'='actor' THEN PERFORM relevo_assert_ref(e,'actor',r.principal->>'actorId'); END IF;
    IF r.principal->>'kind'='reporter' AND NOT EXISTS(SELECT 1 FROM report_sessions WHERE id=r.principal->>'sessionId') THEN RAISE EXCEPTION 'Invalid reporter session' USING ERRCODE='23503'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER actors_references AFTER INSERT OR UPDATE OR DELETE ON "actors" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER tickets_references AFTER INSERT OR UPDATE OR DELETE ON "tickets" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER handoffs_references AFTER INSERT OR UPDATE OR DELETE ON "handoffs" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER handoff_attempts_references AFTER INSERT OR UPDATE OR DELETE ON "handoff_attempts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER coverage_windows_references AFTER INSERT OR UPDATE OR DELETE ON "coverage_windows" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER incidents_references AFTER INSERT OR UPDATE OR DELETE ON "incidents" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER incident_attempts_references AFTER INSERT OR UPDATE OR DELETE ON "incident_attempts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER reports_references AFTER INSERT OR UPDATE OR DELETE ON "reports" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER events_references AFTER INSERT OR UPDATE OR DELETE ON "events" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER notification_intents_references AFTER INSERT OR UPDATE OR DELETE ON "notification_intents" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
CREATE CONSTRAINT TRIGGER recipient_grants_references AFTER INSERT OR UPDATE OR DELETE ON "recipient_grants" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION relevo_check_references();
