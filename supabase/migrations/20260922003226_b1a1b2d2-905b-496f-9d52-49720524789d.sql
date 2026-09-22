CREATE TABLE public.salas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  host text NOT NULL,
  modo text NOT NULL DEFAULT 'sufrimiento',
  asesinos int NOT NULL DEFAULT 2,
  jugadores int NOT NULL DEFAULT 1,
  maximo int NOT NULL DEFAULT 6,
  estado text NOT NULL DEFAULT 'abierta',
  latido timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salas TO authenticated;
GRANT ALL ON public.salas TO service_role;

ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salas visibles para todos" ON public.salas FOR SELECT USING (true);
CREATE POLICY "cualquiera crea salas" ON public.salas FOR INSERT WITH CHECK (true);
CREATE POLICY "cualquiera actualiza salas" ON public.salas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cualquiera borra salas" ON public.salas FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.salas;