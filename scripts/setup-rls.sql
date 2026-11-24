-- Enable Row-Level Security on all tenant-isolated tables with strict PERMISSIVE isolation

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        '"User"',
        '"Employee"',
        '"Department"',
        '"LeaveType"',
        '"PublicHoliday"',
        '"Document"',
        '"Client"',
        '"Project"',
        '"Task"',
        '"TimeEntry"',
        '"Invoice"',
        '"InvoiceSequence"',
        '"Objective"',
        '"ReviewCycle"',
        '"OneOnOne"',
        '"Feedback"',
        '"OnboardingTemplate"',
        '"OnboardingChecklist"',
        '"AuditLog"'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        -- 1. Enable and FORCE row-level security so table owners cannot accidentally bypass
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY;', tbl);
        
        -- 2. Drop existing policy
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %s;', tbl);
        
        -- 3. Create PERMISSIVE policy requiring valid app.org_id or explicit app.bypass_rls
        EXECUTE format('CREATE POLICY tenant_isolation_policy ON %s FOR ALL USING (
            current_setting(''app.bypass_rls'', true) = ''on''
            OR "organizationId" = NULLIF(current_setting(''app.org_id'', true), '''')
        ) WITH CHECK (
            current_setting(''app.bypass_rls'', true) = ''on''
            OR "organizationId" = NULLIF(current_setting(''app.org_id'', true), '''')
        );', tbl);
    END LOOP;
END $$;
