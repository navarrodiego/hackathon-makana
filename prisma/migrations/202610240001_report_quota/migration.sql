-- Cuota global de reportes por ejecución: 50 → 150 (decisión de Diego del 24-10-2026,
-- para 15–40 personas en el canal). Debe coincidir con LIMITS.reportsPerExecution.
ALTER TABLE "executions" DROP CONSTRAINT "executions_admission_range";
ALTER TABLE "executions" ADD CONSTRAINT "executions_admission_range" CHECK ("admittedReports" BETWEEN 0 AND 150);
