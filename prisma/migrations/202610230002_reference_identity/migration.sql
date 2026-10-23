-- Un reset hereda actores/escenas de referencia sin acoplar sus filas a la
-- ejecución retirada. Las FK ya usan el par (executionId,id).
ALTER TABLE actors DROP CONSTRAINT actors_pkey;
ALTER TABLE actors ADD CONSTRAINT actors_pkey PRIMARY KEY ("executionId",id);
ALTER TABLE scenes DROP CONSTRAINT scenes_pkey;
ALTER TABLE scenes ADD CONSTRAINT scenes_pkey PRIMARY KEY ("executionId",id);
